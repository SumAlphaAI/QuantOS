/** The host maps only the declared resource families; the client still reauthorizes. */
export function terminalStaticDocument(pathname,manifest){
 if(manifest?.schema!=='quantos-terminal-static-routes/v1')return undefined;
 const parts=pathname.split('/');
 if(parts[0]===''&&parts[1]==='markets'){
  if(parts.length!==3)return undefined;let symbol;try{symbol=decodeURIComponent(parts[2]);}catch{return undefined;}
  if(!/^[A-Z0-9]{1,20}\/[A-Z0-9]{1,20}$/.test(symbol)||encodeURIComponent(symbol)!==parts[2])return undefined;
  const route=manifest.routes?.find(r=>r.prefix==='markets');return route?.document==='markets.html'&&route.parameter==='symbol'?'markets.html':undefined;
 }
 if(parts[1]==='strategies'){
  if(parts.length!==4||parts[3]!=='lab')return undefined;
 }else if(parts.length!==3||!['audit','exports','data-snapshots','research','artifacts','backtests','releases'].includes(parts[1]))return undefined;
 if(parts[0]!=='')return undefined;
 const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;if(!pattern.test(parts[2]))return undefined;
 const route=manifest.routes?.find(r=>r.prefix===parts[1]);return route?.document===parts[1]+'.html'&&(parts[1]!=='strategies'||route.suffix==='lab')?route.document:undefined;
}
