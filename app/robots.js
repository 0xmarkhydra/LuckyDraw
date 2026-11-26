import {siteOrigin} from '../lib/campaign-seo';
export const dynamic='force-dynamic';
export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/api/']},sitemap:siteOrigin()+'/sitemap.xml'}}
