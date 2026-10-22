/** Format/check digit only; this never certifies registration with a tax authority. */
export function identityCuit(value: string): boolean {
  if (!/^[\d\s-]+$/.test(value)) return false;
  const digits=value.replace(/[\s-]/g,'');
  if(!/^(20|23|24|27|30|33|34)\d{9}$/.test(digits))return false;
  const check=(11-[...digits.slice(0,10)].reduce((sum,c,i)=>sum+Number(c)*[5,4,3,2,7,6,5,4,3,2][i],0)%11)%11;
  return check<10&&check===Number(digits[10]);
}
