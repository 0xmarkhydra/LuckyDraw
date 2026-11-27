import MatchGame from '../../match-game';
export const metadata={title:'Candy Match · Chơi thử | LuckyDraw',description:'Trải nghiệm ghép kẹo trong 90 giây. Không cần đăng ký, không lưu điểm thật.',robots:{index:false,follow:false}};
export default function CandyMatchDemo(){return <MatchGame slug="demo-candy-match" initial={{title:'Ghép kẹo, săn quà',description:'Ghép kẹo, tạo combo và thử sức trong 90 giây.',match_seconds:90,active:true}} preview/>}
