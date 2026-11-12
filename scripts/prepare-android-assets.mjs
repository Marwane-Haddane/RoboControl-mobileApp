import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist/android/assets/hexapod',{recursive:true});
await cp('public/assets/hexapod','dist/android/assets/hexapod',{recursive:true});
await mkdir('dist/android/assets/brand',{recursive:true});
await cp('public/assets/brand','dist/android/assets/brand',{recursive:true});
await mkdir('dist/android/assets/car',{recursive:true});
await cp('public/assets/car','dist/android/assets/car',{recursive:true});
console.log('Offline Android assets prepared.');
