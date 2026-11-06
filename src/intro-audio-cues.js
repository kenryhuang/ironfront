export const VOICE_CUES=[
 {id:'contact',time:8.3,text:'中文 / 战场呼喊',file:'field-zh.mp3',offset:1,duration:3.4},
 {id:'advance',time:12.5,text:'英语 / To War!（投入战斗！）',file:'field-en.mp3',offset:0,duration:2.19},
 {id:'ready',time:18,text:'俄语 / Огонь!（开火！）',file:'field-ru.mp3',offset:0,duration:1.5},
 {id:'cover',time:36,text:'中文 / 战场呼喊',file:'field-zh.mp3',offset:8,duration:3},
];
export function voiceCueAt(time,played){return VOICE_CUES.find(c=>time>=c.time&&time<c.time+1.2&&!played.has(c.id))??null;}
