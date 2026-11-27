// Distinguish publication from eligibility to start a full round.
export function matchAvailability(cfg,now=Date.now()){
 if(cfg.match_finalized_at)return 'finalized';
 if(cfg.ends_at&&Date.parse(cfg.ends_at)<=now)return 'ended';
 if(!cfg.active)return 'unpublished';
 if(cfg.starts_at&&Date.parse(cfg.starts_at)>now)return 'scheduled';
 if(cfg.ends_at&&Date.parse(cfg.ends_at)<now+(cfg.match_seconds||90)*1000)return 'closing';
 return 'open';
}
export const matchStatusLabels={finalized:'Đã chốt kết quả',ended:'Đã kết thúc',unpublished:'Chưa công bố / tạm dừng',scheduled:'Đã lên lịch',closing:'Đang kết thúc',open:'Đang chạy'};
export const matchPlayerLabels={finalized:'Đã chốt kết quả',ended:'Chiến dịch đã kết thúc',unpublished:'Chiến dịch chưa mở',scheduled:'Chưa đến giờ bắt đầu',closing:'Đã ngừng nhận lượt mới',open:'Chơi ngay'};
