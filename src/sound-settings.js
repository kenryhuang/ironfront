export function soundEnabled(){try{return localStorage.getItem('ironfront.sound')==='on';}catch{return false;}}
export function saveSound(value){try{localStorage.setItem('ironfront.sound',value?'on':'off');}catch{}}
