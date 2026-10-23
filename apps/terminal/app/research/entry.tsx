"use client";
import {useEffect,useState} from "react";
import {ResearchRoute} from "./workspace";
import {ResearchDetailRoute} from "./detail";
import {researchLocation} from "../../src/research/detail-policy";
export function ResearchEntry(){
 const [route,setRoute]=useState<{id?:string;invalid?:boolean}>();
 useEffect(()=>{try{setRoute({id:researchLocation(location.pathname,location.search)});}catch{setRoute({invalid:true});}},[]);
 if(!route)return <main><h1>正在解析 Research 路由</h1></main>;
 if(route.invalid)return <main><h1>研究引用无效</h1><a href="/research">返回 Research 列表</a></main>;
 return route.id?<ResearchDetailRoute runId={route.id}/>:<ResearchRoute/>;
}
