/** Never draw a straight GPS line between positions emitted by different legs. */
export function transportTrackSegments(points:Array<{latitud:number;longitud:number;tramoId?:string|null}>) {
  const segments:Array<[number,number][]> = [];
  let previous:string|null|undefined=undefined;
  for(const point of points){
    const leg=point.tramoId??null;
    if(segments.length===0||leg!==previous)segments.push([]);
    segments[segments.length-1].push([point.latitud,point.longitud]);previous=leg;
  }
  return segments;
}
