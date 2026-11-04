export function syntheticCuit(seed: number): string {
  for (let n=seed; ; n++) {
    const base='30'+String(n % 100000000).padStart(8,'0');
    const check=(11-[...base].reduce((sum,c,i)=>sum+Number(c)*[5,4,3,2,7,6,5,4,3,2][i],0)%11)%11;
    if(check<10)return base.slice(0,2)+'-'+base.slice(2)+'-'+check;
  }
}
