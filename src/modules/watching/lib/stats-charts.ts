interface ActivityPoint { label:string; count:number }
/** Keep missing calendar positions visible; no month precision is invented for an empty year. */
export function activitySlots(activity:ActivityPoint[],year:number|null):ActivityPoint[] {
  if (year==null || !activity.length) return activity;
  const counts=new Map(activity.map(a=>[a.label,a.count]));
  return Array.from({length:12},(_,index)=>{
    const label=`${year}-${String(index+1).padStart(2,"0")}`;
    return {label,count:counts.get(label) ?? 0};
  });
}

/** Points AND labels share one numeric x scale. Cubic controls stay inside each segment. */
export function ratingDistributionPlot(distribution:{score:number;count:number}[]) {
  const rated=distribution.filter(d=>d.count>0).sort((a,b)=>a.score-b.score);
  const minScore=rated[0]?.score ?? 1,maxScore=rated.at(-1)?.score ?? 10;
  const visible=distribution.filter(d=>d.score>=minScore && d.score<=maxScore).sort((a,b)=>a.score-b.score);
  const total=rated.reduce((n,d)=>n+d.count,0),max=Math.max(1,...visible.map(d=>d.count));
  const width=200,height=72,padX=8,padY=6,plotWidth=width-padX*2,plotHeight=height-padY*2;
  const points=visible.map(d=>({...d,x:minScore===maxScore ? width/2 : padX+(d.score-minScore)/(maxScore-minScore)*plotWidth,
    y:padY+plotHeight-d.count/max*plotHeight}));
  const segments=points.slice(1).map((p,index)=>{
    const from=points[index],mid=(from.x+p.x)/2;
    return {from,to:p,c1:{x:mid,y:from.y},c2:{x:mid,y:p.y}};
  });
  const linePath=points.length ? `M ${points[0].x} ${points[0].y}`+segments.map(s=>` C ${s.c1.x} ${s.c1.y}, ${s.c2.x} ${s.c2.y}, ${s.to.x} ${s.to.y}`).join("") : "";
  const areaPath=points.length ? `${linePath} L ${points.at(-1)!.x} ${height} L ${points[0].x} ${height} Z` : "";
  const ticks=points.filter((p,index)=>index===0 || index===points.length-1 || Number.isInteger(p.score));
  const labels=ticks.filter((p,index)=>index===0 || index===ticks.length-1 ||
    p.x-ticks[index-1].x>=16 && ticks[ticks.length-1].x-p.x>=16);
  return {total,minScore,maxScore,width,height,points,segments,linePath,areaPath,labels};
}
