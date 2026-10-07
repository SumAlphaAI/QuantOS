//! Audit-only configured Supabase checks. Retain owned metadata; disable owned actor.
use std::env;
use bytes::Bytes;
use chrono::{Duration,Utc};
use postgres::{Client,types::Type};
use native_tls::TlsConnector;
use postgres_native_tls::MakeTlsConnector;
use quantos_core::{ActorId,ContentHash,SchemaVersion,TenantId};
use quantos_storage::{*,pg::PgStorageStore,supabase_storage::*};
use serde_json::json;
fn db(url:&str)->Client {
 let u=url::Url::parse(url).unwrap();let relaxed=u.query_pairs().any(|(k,v)|k=="sslmode"&&matches!(v.as_ref(),"require"|"prefer"));
 let mut b=TlsConnector::builder();b.danger_accept_invalid_certs(relaxed);Client::connect(url,MakeTlsConnector::new(b.build().unwrap())).unwrap()
}
struct Guard{url:String,tenant:TenantId,actor:ActorId}
impl Drop for Guard {fn drop(&mut self){let mut d=db(&self.url);d.execute_typed("update quantos.actors set is_active=false where id=$1 and tenant_id=$2",&[(self.actor.as_uuid(),Type::UUID),(self.tenant.as_uuid(),Type::UUID)]).unwrap();println!("AUDIT_OWNED actor_inactive={} tenant_retained={} actor={}",true,self.tenant,self.actor);}}
fn owned()->(String,Guard) {
 let url=env::var("DATABASE_URL").unwrap();let tenant=TenantId::new();let actor=ActorId::new();let mut d=db(&url);println!("AUDIT_STEP setup connected tenant={}",tenant);
 d.execute_typed("insert into quantos.tenants(id,slug,name) values($1,$2,'R02 audit fixture retained')",&[(tenant.as_uuid(),Type::UUID),(&format!("r02-audit-{}",tenant),Type::TEXT)]).unwrap();
 d.execute_typed("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','R02 audit fixture','r02-audit')",&[(actor.as_uuid(),Type::UUID),(tenant.as_uuid(),Type::UUID)]).unwrap();
 println!("AUDIT_OWNED tenant={} actor={}",tenant,actor);
 (url.clone(),Guard{url,tenant,actor})
}
#[test]
fn native_pg_adapter_persists_and_loads_unverified_snapshot_hash_and_expiry() {
 let(url,g)=owned();let now=Utc::now();let mut s=DataSnapshotRecord::new(g.tenant,DataSnapshotInput{
 schema_name:"DataSnapshot".into(),schema_version:SchemaVersion::parse("v1").unwrap(),schema_entry_id:None,
 window:SnapshotWindow{start_at:now-Duration::seconds(60),end_at:now},
 sources:vec![SnapshotSourceRef{source_id:"audit".into(),provider:"fixture-only".into(),dataset:"audit".into(),license_label:"fixture-only".into()}],quality:SnapshotQuality::Passed,quality_findings:vec![],license_label:"fixture-only".into(),captured_at:now,max_age_secs:120,symbols:vec!["BTC/USDT".into()],artifact_refs:vec![],lineage:vec![SnapshotLineageEntry{lineage_kind:"audit".into(),reference:"audit".into(),details:json!({"not_market_data":true})}]},now).unwrap();
 let canonical=s.content_hash.clone();s.content_hash=ContentHash::sha256_bytes(b"deliberately unrelated hash");s.expires_at=now+Duration::days(30);
 let mut p=PgStorageStore::connect(&url).unwrap();let saved=p.upsert_data_snapshot(&s).unwrap();assert_ne!(saved.content_hash,canonical);
 let mut cold=PgStorageStore::connect(&url).unwrap();let read=cold.get_data_snapshot(g.tenant,s.snapshot_id).unwrap().unwrap();assert_eq!(read.content_hash,s.content_hash);
 let rules=SnapshotQualityRuleset::from_rules(default_quality_rules(g.tenant,now));assert!(SnapshotQualityGate::evaluate(&read,SnapshotUsage::Trading,now+Duration::days(1),&rules).allowed);
 println!("AUDIT_DEFECT native persisted and cold loaded forged hash/expiry; gate accepted at one day");
}
#[test]
fn actual_storage_compensation_deletes_preexisting_owned_object_on_registration_failure() {
 let(url,g)=owned();let mut p=PgStorageStore::connect(&url).unwrap();
 let a=SupabaseStorageAdapter::connect(SupabaseStorageConfig{project_url:env::var("SUPABASE_URL").unwrap(),bucket_name:env::var("SUPABASE_STORAGE_BUCKET").unwrap_or_else(|_|"quantos-artifacts".into()),api_key:env::var("SUPABASE_SERVICE_ROLE_KEY").unwrap(),authorization_token:None,upsert:true}).unwrap();
 let body=Bytes::from_static(b"R02 temporary audit object, not market data");let mut m=ArtifactManifest::new(g.tenant,"application/octet-stream",ContentHash::sha256_bytes(&body),env::var("SUPABASE_STORAGE_BUCKET").unwrap_or_else(|_|"quantos-artifacts".into()),body.len() as u64,Utc::now());m.metadata.insert("purpose".into(),"r02-owned-temporary-audit".into());
 let registered=a.upload_and_register(&mut p,&m,body.clone()).unwrap();assert_eq!(a.get_artifact(&registered).unwrap(),body);
 println!("AUDIT_TARGET real Supabase Storage upload/register/download PASS key={}",registered.object_key);
 let mut bad=registered.clone();bad.tenant_id=TenantId::new(); // this new tenant does not exist; object key remains the owned existing path
 let failed=a.upload_and_register(&mut p,&bad,body);assert!(matches!(failed,Err(SupabaseStorageError::Persist(_))));
 let read=a.get_artifact(&registered);assert!(matches!(read,Err(SupabaseStorageError::HttpStatus{status,..}) if status.as_u16()==404));
 assert!(p.find_artifact_by_hash(g.tenant,&registered.content_hash).unwrap().is_some());
 println!("AUDIT_DEFECT compensating DELETE removed previously registered owned object; manifest remains dangling");
}
