//! `zeryth`: the engine, natively, against mainnet.
//!
//! The browser runs the same scan and sweep over gRPC-web. This binary drives them over
//! plain gRPC so every money-moving step can be exercised from a terminal first.
//!
//! ```sh
//! zeryth tip
//! zeryth keygen
//! zeryth open  <secret> <birthday>
//! zeryth sweep <secret> <birthday> <to> [--split <zat> <addr>] [--out <zat> <addr>]...
//!              [--memo <text>] [--broadcast]
//! ```
//!
//! `sweep` sends everything the key holds to `<to>`. With `--split`, exactly `<zat>`
//! goes to `<addr>` and the rest to `<to>`: that is a round payout, a round number to
//! the vault and the remainder carried into the next round's key. Each `--out` is one
//! more fixed output, which is how a batch of claim cards is funded in one transaction.
//!
//! Without `--broadcast` the transaction is built, proved and thrown away.

use std::collections::BTreeSet;
use std::time::Instant;

use futures_util::StreamExt;
use serde_json::{json, Value};
use tonic::transport::{Channel, ClientTlsConfig};
use zcash_client_backend::proto::service::{
    compact_tx_streamer_client::CompactTxStreamerClient, BlockId, BlockRange, ChainSpec, TxFilter,
};
use zcash_protocol::consensus::Network;
use zcash_protocol::TxId;

use zeryth_engine::scan::{
    finish_open, notes_from_transaction, parse_transaction, scan_compact_blocks, scan_range,
    OpenResult, SpendWatch, ViewKeys,
};
use zeryth_engine::sweep::{sweep, NoteRef, SweepRequest};

const DEFAULT_SERVER: &str = "https://zec.rocks:443";
const NETWORK: Network = Network::MainNetwork;

type Client = CompactTxStreamerClient<Channel>;

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args).await {
        Ok(out) => println!("{}", serde_json::to_string_pretty(&out).unwrap()),
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    }
}

async fn run(args: &[String]) -> Result<Value, String> {
    let cmd = args.first().map(String::as_str).unwrap_or("help");
    match cmd {
        "tip" => {
            let mut client = connect().await?;
            Ok(json!({ "tip": tip(&mut client).await? }))
        }
        "keygen" => {
            let mut client = connect().await?;
            let birthday = tip(&mut client).await?;
            let secret = zeryth_engine::encode_secret(&zeryth_engine::generate_secret_bytes()?);
            let derived = zeryth_engine::derive_from_secret(&secret, NETWORK)?;
            Ok(json!({
                "secret": secret,
                "birthday": birthday,
                "address": derived.address,
                "ufvk": derived.ufvk,
            }))
        }
        "derive" => {
            let secret = arg(args, 1, "secret")?;
            let derived = zeryth_engine::derive_from_secret(secret, NETWORK)?;
            Ok(json!({ "address": derived.address, "ufvk": derived.ufvk }))
        }
        "open" => {
            let secret = arg(args, 1, "secret")?;
            let birthday = parse_u32(arg(args, 2, "birthday")?)?;
            let mut client = connect().await?;
            let opened = open(&mut client, secret, birthday).await?;
            Ok(open_json(&opened))
        }
        "sweep" => {
            let secret = arg(args, 1, "secret")?.to_string();
            let birthday = parse_u32(arg(args, 2, "birthday")?)?;
            let destination = arg(args, 3, "destination")?.to_string();
            let mut split_zat = 0u64;
            let mut split_address = String::new();
            let mut splits = Vec::new();
            let mut memo = None;
            let mut broadcast = false;
            let mut i = 4;
            while i < args.len() {
                match args[i].as_str() {
                    "--split" => {
                        split_zat = arg(args, i + 1, "split amount")?
                            .parse()
                            .map_err(|e| format!("split amount: {e}"))?;
                        split_address = arg(args, i + 2, "split address")?.to_string();
                        i += 3;
                    }
                    "--out" => {
                        let zat = arg(args, i + 1, "output amount")?
                            .parse()
                            .map_err(|e| format!("output amount: {e}"))?;
                        splits.push((arg(args, i + 2, "output address")?.to_string(), zat));
                        i += 3;
                    }
                    "--memo" => {
                        memo = Some(arg(args, i + 1, "memo")?.to_string());
                        i += 2;
                    }
                    "--broadcast" => {
                        broadcast = true;
                        i += 1;
                    }
                    other => return Err(format!("unknown flag {other}")),
                }
            }

            let mut client = connect().await?;
            let opened = open(&mut client, &secret, birthday).await?;
            let notes: Vec<NoteRef> = opened
                .notes
                .iter()
                .filter(|n| n.spent.is_none())
                .map(|n| NoteRef {
                    txid: n.txid.clone(),
                    height: n.height,
                    action_index: n.action_index,
                })
                .collect();
            if notes.is_empty() {
                return Err("this key holds no unspent notes".to_string());
            }

            let request = SweepRequest {
                secret_b64url: secret,
                network: NETWORK,
                notes,
                destination,
                fee_address: split_address,
                fee_zat: split_zat,
                splits,
                memo,
                broadcast,
            };
            let started = Instant::now();
            let mut on_stage = |stage: &str, detail: &str| {
                eprintln!("[{:>6.1}s] {stage}: {detail}", started.elapsed().as_secs_f64());
            };
            let outcome = sweep(&mut client, &request, Some(opened.tip_height), &mut on_stage).await?;
            Ok(json!({
                "txid": outcome.txid,
                "broadcast": outcome.broadcast,
                "to_destination_zat": outcome.amount_to_destination_zat,
                "to_split_zat": outcome.fee_zat,
                "network_fee_zat": outcome.network_fee_zat,
                "anchor_height": outcome.anchor_height,
                "error_code": outcome.error_code,
                "error_message": outcome.error_message,
                "raw_tx_bytes": outcome.raw_tx_hex.as_ref().map(|h| h.len() / 2),
                "seconds": started.elapsed().as_secs_f64(),
            }))
        }
        _ => Err("usage: zeryth tip | keygen | derive <secret> | open <secret> <birthday> | \
                  sweep <secret> <birthday> <to> [--split <zat> <addr>] [--out <zat> <addr>]... \
                  [--memo <text>] [--broadcast]"
            .to_string()),
    }
}

async fn connect() -> Result<Client, String> {
    let server = std::env::var("ZERYTH_LIGHTWALLETD").unwrap_or_else(|_| DEFAULT_SERVER.to_string());
    let channel = Channel::from_shared(server.clone())
        .map_err(|e| format!("bad server url {server}: {e}"))?
        .tls_config(ClientTlsConfig::new().with_webpki_roots())
        .map_err(|e| format!("TLS config: {e}"))?
        .connect()
        .await
        .map_err(|e| format!("connecting to {server}: {e}"))?;
    // Mainnet blocks and transactions both exceed tonic's 4 MiB default.
    Ok(CompactTxStreamerClient::new(channel).max_decoding_message_size(64 * 1024 * 1024))
}

async fn tip(client: &mut Client) -> Result<u32, String> {
    let latest = client
        .get_latest_block(ChainSpec {})
        .await
        .map_err(|e| format!("GetLatestBlock failed: {}", e.message()))?
        .into_inner();
    u32::try_from(latest.height).map_err(|_| "tip height overflows u32".to_string())
}

/// The native twin of the browser's `open_envelope`: walk compact blocks from the
/// birthday to the tip, then fetch every hit in full for its memo.
async fn open(client: &mut Client, secret: &str, birthday: u32) -> Result<OpenResult, String> {
    let keys = ViewKeys::from_secret(secret, NETWORK)?;
    let tip_height = tip(client).await?;
    let (start, birthday_defaulted, scanned_blocks) = scan_range(Some(birthday), tip_height);

    let mut stream = client
        .get_block_range(BlockRange {
            start: Some(BlockId { height: u64::from(start), hash: Vec::new() }),
            end: Some(BlockId { height: u64::from(tip_height), hash: Vec::new() }),
            pool_types: Vec::new(),
        })
        .await
        .map_err(|e| format!("GetBlockRange failed: {}", e.message()))?
        .into_inner();

    let mut hits: BTreeSet<(u32, TxId)> = BTreeSet::new();
    let mut watch = SpendWatch::new();
    let mut chunk = Vec::new();
    while let Some(block) = stream.next().await {
        chunk.push(block.map_err(|e| format!("block stream failed: {}", e.message()))?);
        if chunk.len() == 256 {
            hits.extend(scan_compact_blocks(&chunk, &keys, &mut watch)?);
            chunk.clear();
        }
    }
    hits.extend(scan_compact_blocks(&chunk, &keys, &mut watch)?);

    let mut notes = Vec::new();
    for (height, txid) in hits {
        let raw = client
            .get_transaction(TxFilter { block: None, index: 0, hash: txid.as_ref().to_vec() })
            .await
            .map_err(|e| format!("GetTransaction({txid}) failed: {}", e.message()))?
            .into_inner();
        let tx = parse_transaction(&raw.data, height, NETWORK)?;
        notes.extend(notes_from_transaction(&tx, height, &keys, NETWORK));
    }

    finish_open(notes, &watch, tip_height, start, birthday_defaulted, scanned_blocks, String::new())
}

fn open_json(opened: &OpenResult) -> Value {
    json!({
        "tip": opened.tip_height,
        "birthday": opened.birthday,
        "scanned_blocks": opened.scanned_blocks,
        "unspent_zat": opened.total_zat,
        "spent_zat": opened.spent_zat,
        "notes": opened.notes.iter().map(|n| json!({
            "txid": n.txid,
            "height": n.height,
            "action_index": n.action_index,
            "pool": n.pool,
            "amount_zat": n.amount_zat,
            "memo": n.memo,
            "spent": n.spent.as_ref().map(|s| json!({ "txid": s.txid, "height": s.height })),
        })).collect::<Vec<_>>(),
    })
}

fn arg<'a>(args: &'a [String], i: usize, name: &str) -> Result<&'a str, String> {
    args.get(i).map(String::as_str).ok_or_else(|| format!("missing {name}"))
}

fn parse_u32(s: &str) -> Result<u32, String> {
    s.parse().map_err(|e| format!("{s:?} is not a block height: {e}"))
}
