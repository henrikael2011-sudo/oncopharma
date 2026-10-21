import fs from 'node:fs'; import crypto from 'node:crypto';
const paths=['app/globals.css','public/brand/care.svg','public/brand/clinical.svg','public/brand/mark.svg','components/Brand.tsx','app/fonts/DMSans-Variable.ttf'];
let errors=[];for(const app of ['portal','care-web','clinical-web'])for(const p of paths){const canonical=fs.readFileSync('packages/design-system/'+p);const local=fs.readFileSync('apps/'+app+'/'+p);if(!canonical.equals(local))errors.push(app+': '+p)}
if(errors.length){console.error('Divergência de identidade:',errors);process.exitCode=1}else console.log('Design system: '+paths.length*3+' arquivos alinhados à referência canônica');
