// Sara paisa integers (paisa) mein store hota hai
export const toPaisa = (rs) => Math.round(Number(rs) * 100);
export const toRs = (paisa) => (paisa || 0) / 100;
export const formatRs = (paisa) => 'Rs ' + Math.round((paisa || 0) / 100).toLocaleString('en-PK');