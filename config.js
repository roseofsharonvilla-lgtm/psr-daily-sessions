window.PSR_SEND_URL = "";
window.PSR_CATS = [];
window.PSR_ADD = function(name, items){ var c = window.PSR_CATS.find(function(x){ return x.name === name; }); if (!c) { c = {name:name, items:[]}; window.PSR_CATS.push(c); } items.forEach(function(i){ c.items.push(i); }); };
