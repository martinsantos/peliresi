/** Select the deepest visible destination, with a path-segment boundary. */
export function currentNavigationItem<T extends {path:string}>(pathname:string,items:readonly T[]):T|undefined {
  let selected:T|undefined;
  for(const item of items){
    const matches=pathname===item.path||pathname.startsWith(item.path+'/');
    if(matches&&(!selected||item.path.length>selected.path.length))selected=item;
  }
  return selected;
}
