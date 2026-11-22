// Pure input parsing; never fetch or navigate to a pasted URL.
export function parseRoomInput(value,baseURL){
 const raw=String(value??'').normalize('NFKC').trim();
 const valid=code=>/^[0-9a-f]{6}$/i.test(code??'');
 if(valid(raw))return {ok:true,code:raw.toUpperCase()};
 if(!raw)return {ok:false,message:'请输入房主创建后提供的六位房间码，或粘贴完整邀请链接。'};
 try{
  const url=new URL(raw,baseURL),code=url.searchParams.get('room')?.trim();
  if(['http:','https:'].includes(url.protocol)&&valid(code)){
   if(url.origin!==new URL(baseURL).origin)return {ok:false,message:'邀请链接来自另一台服务器，请在浏览器中打开原邀请链接后加入。'};
   return {ok:true,code:code.toUpperCase()};
  }
 }catch{}
 return {ok:false,message:'房间码应为六位字母A–F和数字，也可以直接粘贴完整邀请链接。'};
}
