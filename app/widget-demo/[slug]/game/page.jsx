import DemoGame from './demo-game';
export default async function WidgetDemoGame({params}){const {slug}=await params;if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug))return <p>Không tìm thấy chiến dịch.</p>;return <DemoGame slug={slug}/>}
