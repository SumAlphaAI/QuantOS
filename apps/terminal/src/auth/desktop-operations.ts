'use client';
import {useEffect,useState} from 'react';
/** ACC-FLOW-10 presentation boundary. Server capabilities remain independently authoritative. */
export const desktopOperationsAllowed=()=>typeof window!=='undefined'&&window.matchMedia('(min-width: 768px)').matches;
export function useDesktopOperations(){const [allowed,setAllowed]=useState(false);useEffect(()=>{const media=window.matchMedia('(min-width: 768px)'),update=()=>setAllowed(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);return allowed;}
