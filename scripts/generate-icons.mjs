// Generate static icons directly from the pinned Lucide package.
// No handcrafted SVG paths, runtime CDN, or additional browser dependency.
import {readFileSync,writeFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gift,X} from 'lucide-react';
const svg=(component,props={})=>renderToStaticMarkup(createElement(component,{size:24,strokeWidth:1.8,'aria-hidden':true,focusable:false,...props}));
const icons={gift:svg(Gift),close:svg(X)};
const widgetPath=new URL('../public/widget.js',import.meta.url);
const source=readFileSync(widgetPath,'utf8');
const marker=/\/\* LUCIDE_ICONS_START \*\/[\s\S]*?\/\* LUCIDE_ICONS_END \*\//;
if(!marker.test(source))throw Error('Widget icon marker not found');
const widget=source.replace(marker,'/* LUCIDE_ICONS_START */\n const libraryIcons='+JSON.stringify(icons)+';\n /* LUCIDE_ICONS_END */');
const favicon=svg(Gift,{size:64,color:'#ae2941',strokeWidth:1.7})+'\n';
const faviconPath=new URL('../app/icon.svg',import.meta.url);
if(process.argv.includes('--check')){
 if(widget!==source||readFileSync(faviconPath,'utf8')!==favicon)throw Error('Generated Lucide icons are out of date');
 console.log('PASS: Widget and favicon use generated Lucide assets');
}else{writeFileSync(widgetPath,widget);writeFileSync(faviconPath,favicon);console.log('Generated Widget and favicon icons from lucide-react')}
