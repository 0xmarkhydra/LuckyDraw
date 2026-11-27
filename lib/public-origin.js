// Stable public links, independent of the domain used to open admin.
export const PUBLIC_ORIGIN='https://lucky.codelocal.cloud';
export const campaignUrl=slug=>PUBLIC_ORIGIN+'/c/'+encodeURIComponent(slug);
