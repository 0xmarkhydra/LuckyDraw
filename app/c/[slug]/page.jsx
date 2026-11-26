import Home from '../../game-client';
export default async function CampaignPage({params}){const {slug}=await params;return <Home key={slug} campaignSlug={slug}/>}