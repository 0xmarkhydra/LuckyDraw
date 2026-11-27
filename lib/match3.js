// Deterministic, dependency-free Match-3 engine. Server keeps RNG state private.
export const SIZE=8, TYPES=6;
function random(state){let x=state>>>0||1;x^=x<<13;x^=x>>>17;x^=x<<5;return x>>>0}
function next(r){r.value=random(r.value);return r.value%TYPES}
export function matches(board){
 const set=new Set();
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const i=y*SIZE+x,v=board[i];if(v<0)continue;
  if(x<=SIZE-3&&board[i+1]===v&&board[i+2]===v){set.add(i);set.add(i+1);set.add(i+2)}
  if(y<=SIZE-3&&board[i+SIZE]===v&&board[i+2*SIZE]===v){set.add(i);set.add(i+SIZE);set.add(i+2*SIZE)}
 }return set;
}
export function adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<64&&b<64&&Math.abs(Math.floor(a/8)-Math.floor(b/8))+Math.abs(a%8-b%8)===1}
function swap(board,a,b){const copy=board.slice();[copy[a],copy[b]]=[copy[b],copy[a]];return copy}
export function prepareSwap(board,a,b){if(!Array.isArray(board)||board.length!==64||board.some(v=>!Number.isInteger(v)||v<0||v>=TYPES)||!adjacent(a,b))return null;const swapped=swap(board,a,b),cleared=[...matches(swapped)];return cleared.length?{board:swapped,cleared}:null}
export function possible(board){for(let i=0;i<64;i++)for(const j of [i+1,i+8])if(adjacent(i,j)&&matches(swap(board,i,j)).size)return [i,j];return null}
export function createBoard(seed){
 const r={value:seed>>>0||1};
 for(let attempt=0;attempt<200;attempt++){
  const b=[];for(let i=0;i<64;i++){let v;do{v=next(r)}while((i%8>=2&&b[i-1]===v&&b[i-2]===v)||(i>=16&&b[i-8]===v&&b[i-16]===v));b.push(v)}
  if(possible(b))return {board:b,rng:r.value};
 }throw Error('BOARD_GENERATION');
}
export function move(board,seed,a,b){
 const prepared=prepareSwap(board,a,b);if(!prepared)return null;
 let current=prepared.board,m=new Set(prepared.cleared);
 const r={value:seed>>>0||1};let score=0,combo=0,cleared=0;const stages=[];
 while(m.size&&combo<40){
  combo++;const removed=[...m],delta=m.size*10*combo,falls=Array(64).fill(0);cleared+=m.size;score+=delta;
  for(const i of m)current[i]=-1;
  for(let x=0;x<8;x++){let write=7;for(let y=7;y>=0;y--)if(current[y*8+x]>=0){falls[write*8+x]=write-y;current[write--*8+x]=current[y*8+x]}const spawn=write+1;while(write>=0){falls[write*8+x]=spawn;current[write--*8+x]=next(r)}}
  if(stages.length<3)stages.push({removed,board:current.slice(),falls,delta});
  m=matches(current);
 }
 if(m.size||!possible(current)){const fresh=createBoard(r.value);current=fresh.board;r.value=fresh.rng}
 return {board:current,rng:r.value,score,combo,cleared,stages};
}