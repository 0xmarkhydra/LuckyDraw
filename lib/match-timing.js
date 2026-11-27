// Server processing is not network transit. Use the best network sample for a round.
export function clockSample(previous,{expiry,serverNow,rtt=0,serverElapsed=0,now}){
 const network=Math.max(0,rtt-Math.max(0,serverElapsed)),at=now+Math.max(0,expiry-serverNow-network/2);
 if(previous?.expiry===expiry&&previous.network<=network)return previous;
 return {expiry,at,network};
}
export function animationStages(stages,combo){return (stages||[]).slice(0,combo>1?2:1)}
