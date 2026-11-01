import {CombinedArmsGame} from './combined-arms-game.js';
// Bench preset explicitly grants prototype stock and research.
export class LocalArmsGame extends CombinedArmsGame {constructor(config){super(config,{demo:true});}}
