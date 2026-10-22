/** The host maps only the declared resource families; the client still reauthorizes. */
export function terminalStaticDocument(pathname,manifest){
 if(manifest?.schema!=='quantos-terminal-static-routes/v1')return undefined;
 const parts=pathname.split('/');if(parts.length!==3||parts[0]!==''||!['audit','exports','data-snapshots'].includes(parts[1]))return undefined;
 const pattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;if(!pattern.test(parts[2]))return undefined;
 const route=manifest.routes?.find(r=>r.prefix===parts[1]);return route?.document===parts[1]+'.html'?route.document:undefined;
}
