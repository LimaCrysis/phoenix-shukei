(function(){
  "use strict";

  var STORAGE = {
    draft:"shukei_draft_v210",
    history:"shukei_history_v210",
    prices:"shukei_prices_v210"
  };

  var DEFAULT_PRICES = [
    {key:"yokohama20", label:"横浜20F", price:15500},
    {key:"yokohama40", label:"横浜40F", price:20500},
    {key:"tokyo20", label:"東京20F", price:13000},
    {key:"tokyo40", label:"東京40F", price:18000}
  ];

  var workersEl = document.getElementById("workers");
  var grandTotalEl = document.getElementById("grandTotal");
  var workDateEl = document.getElementById("workDate");
  var saveStatusEl = document.getElementById("saveStatus");

  var PRICES = loadJSON(STORAGE.prices, DEFAULT_PRICES);
  var draft = loadJSON(STORAGE.draft, null);
  var workers = draft && draft.workers ? draft.workers : [newWorker()];
  var currentDate = draft && draft.date ? draft.date : todayValue();
  var updatedAt = draft && draft.updatedAt ? draft.updatedAt : null;

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function loadJSON(key,fallback){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : clone(fallback);
    }catch(e){
      return clone(fallback);
    }
  }

  function saveJSON(key,value){
    localStorage.setItem(key,JSON.stringify(value));
  }

  function formatYen(value){
    return Number(value || 0).toLocaleString("ja-JP") + "円";
  }

  function todayValue(){
    var d = new Date();
    var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  function uid(){
    return String(Date.now()) + Math.random().toString(36).slice(2);
  }

  function newWorker(){
    return {
      id:uid(),
      name:"",
      counts:{yokohama20:0,yokohama40:0,tokyo20:0,tokyo40:0}
    };
  }

  function workerTotal(worker,priceSet){
    priceSet = priceSet || PRICES;
    var total = 0;
    priceSet.forEach(function(item){
      total += Number(worker.counts[item.key] || 0) * Number(item.price);
    });
    return total;
  }

  function validWorkers(list){
    return (list || workers).filter(function(worker){
      var hasCount = Object.keys(worker.counts).some(function(key){
        return Number(worker.counts[key]) > 0;
      });
      return worker.name.trim() !== "" && hasCount;
    });
  }

  function ensureLastBlank(){
    if(workers.length === 0){
      workers.push(newWorker());
      return;
    }
    while(workers.length > 1){
      var last = workers[workers.length-1];
      var prev = workers[workers.length-2];
      var lastBlank = last.name.trim()==="" && Object.keys(last.counts).every(function(k){return Number(last.counts[k])===0;});
      var prevBlank = prev.name.trim()==="" && Object.keys(prev.counts).every(function(k){return Number(prev.counts[k])===0;});
      if(lastBlank && prevBlank){ workers.pop(); } else { break; }
    }
    var finalWorker = workers[workers.length-1];
    var hasData = finalWorker.name.trim()!=="" || Object.keys(finalWorker.counts).some(function(k){return Number(finalWorker.counts[k])>0;});
    if(hasData){ workers.push(newWorker()); }
  }

  function autoSave(){
    updatedAt = new Date().toISOString();
    saveJSON(STORAGE.draft,{
      date:currentDate,
      workers:workers,
      updatedAt:updatedAt
    });
    renderStatus("自動保存");
  }

  function renderStatus(label){
    if(!updatedAt){
      saveStatusEl.textContent = "未保存";
      return;
    }
    var d = new Date(updatedAt);
    saveStatusEl.textContent = (label || "自動保存") + "\n" +
      d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  function render(){
    ensureLastBlank();
    workersEl.innerHTML = "";

    workers.forEach(function(worker,index){
      var card = document.createElement("section");
      card.className = "worker";

      var title = document.createElement("div");
      title.className = "worker-title";
      title.textContent = "運転手";

      var name = document.createElement("input");
      name.className = "worker-name";
      name.type = "text";
      name.placeholder = "運転手名を入力";
      name.value = worker.name;

      name.addEventListener("input",function(){
        worker.name = name.value;
        autoSave();
        if(index === workers.length-1 && worker.name.trim()!==""){
          ensureLastBlank();
          render();
          var fields = document.querySelectorAll(".worker-name");
          if(fields[index]){
            fields[index].focus();
            fields[index].setSelectionRange(worker.name.length,worker.name.length);
          }
        }
      });

      card.appendChild(title);
      card.appendChild(name);

      PRICES.forEach(function(item){
        var row = document.createElement("div");
        row.className = "task";

        var left = document.createElement("div");
        var taskName = document.createElement("div");
        taskName.className = "task-name";
        taskName.textContent = item.label;
        var unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = formatYen(item.price) + " / 回";
        left.appendChild(taskName);
        left.appendChild(unit);

        var counter = document.createElement("div");
        counter.className = "counter";

        var minus = document.createElement("button");
        minus.type = "button";
        minus.className = "minus";
        minus.textContent = "−";

        var count = document.createElement("span");
        count.className = "count";
        count.textContent = String(worker.counts[item.key] || 0);

        var plus = document.createElement("button");
        plus.type = "button";
        plus.className = "plus";
        plus.textContent = "＋";

        minus.addEventListener("click",function(){
          worker.counts[item.key] = Math.max(0,Number(worker.counts[item.key] || 0)-1);
          autoSave();
          render();
        });

        plus.addEventListener("click",function(){
          worker.counts[item.key] = Number(worker.counts[item.key] || 0)+1;
          autoSave();
          render();
        });

        counter.appendChild(minus);
        counter.appendChild(count);
        counter.appendChild(plus);
        row.appendChild(left);
        row.appendChild(counter);
        card.appendChild(row);
      });

      var total = document.createElement("div");
      total.className = "worker-total";
      total.innerHTML = "<span>運転手合計</span><strong>"+formatYen(workerTotal(worker))+"</strong>";
      card.appendChild(total);

      var isLastBlank = index===workers.length-1 &&
        worker.name.trim()==="" &&
        Object.keys(worker.counts).every(function(k){return Number(worker.counts[k])===0;});

      if(!isLastBlank){
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove";
        remove.textContent = "この運転手を削除";
        remove.addEventListener("click",function(){
          if(confirm((worker.name || "この運転手")+"を削除しますか？")){
            workers = workers.filter(function(w){return w.id!==worker.id;});
            autoSave();
            render();
          }
        });
        card.appendChild(remove);
      }

      workersEl.appendChild(card);
    });

    var grand = workers.reduce(function(sum,worker){
      return sum + workerTotal(worker);
    },0);
    grandTotalEl.textContent = formatYen(grand);
    workDateEl.value = currentDate;
    renderHistory();
  }

  function addWorker(){
    ensureLastBlank();
    var last = workers[workers.length-1];
    var isBlank = last.name.trim()==="" && Object.keys(last.counts).every(function(k){return Number(last.counts[k])===0;});
    if(!isBlank){ workers.push(newWorker()); }
    render();
    var fields = document.querySelectorAll(".worker-name");
    if(fields.length){ fields[fields.length-1].focus(); }
  }

  function resetAll(){
    if(confirm("全員の入力内容をリセットしますか？")){
      workers = [newWorker()];
      autoSave();
      render();
    }
  }

  function saveHistory(){
    var valid = validWorkers();
    if(valid.length===0){
      alert("名前が入力され、回数が1回以上ある運転手がいません。");
      return;
    }

    var history = loadJSON(STORAGE.history,[]);
    var record = {
      id:uid(),
      date:currentDate,
      workers:clone(valid),
      prices:clone(PRICES),
      total:valid.reduce(function(sum,w){return sum + workerTotal(w);},0),
      savedAt:new Date().toISOString()
    };
    history.unshift(record);
    saveJSON(STORAGE.history,history);
    updatedAt = record.savedAt;
    saveJSON(STORAGE.draft,{date:currentDate,workers:workers,updatedAt:updatedAt});
    renderStatus("履歴保存済み");
    renderHistory();
    alert("履歴に保存しました。");
  }

  function renderHistory(){
    var list = document.getElementById("historyList");
    var query = document.getElementById("historySearch").value.trim().toLowerCase();
    var history = loadJSON(STORAGE.history,[]);
    var filtered = history.filter(function(record){
      var names = record.workers.map(function(w){return w.name;}).join(" ");
      return !query || (record.date+" "+names).toLowerCase().indexOf(query)!==-1;
    });

    document.getElementById("historyCount").textContent = history.length+"件";
    list.innerHTML = "";

    if(filtered.length===0){
      list.innerHTML = '<div class="empty">保存履歴はありません</div>';
      return;
    }

    filtered.forEach(function(record){
      var row = document.createElement("div");
      row.className = "history-item";

      var main = document.createElement("div");
      main.innerHTML =
        '<div class="history-date">'+record.date.replaceAll("-","/")+'</div>'+
        '<div class="history-names">'+record.workers.map(function(w){return escapeHTML(w.name);}).join("、")+'</div>'+
        '<div class="history-total">'+formatYen(record.total)+'</div>';
      main.addEventListener("click",function(){ loadRecord(record); });

      var actions = document.createElement("div");
      actions.className = "history-actions";

      var pdf = document.createElement("button");
      pdf.className = "mini";
      pdf.type = "button";
      pdf.textContent = "PDF";
      pdf.addEventListener("click",function(){ printRecord(record); });

      var del = document.createElement("button");
      del.className = "mini";
      del.type = "button";
      del.textContent = "削除";
      del.addEventListener("click",function(){
        if(confirm("この履歴を削除しますか？")){
          var next = loadJSON(STORAGE.history,[]).filter(function(r){return r.id!==record.id;});
          saveJSON(STORAGE.history,next);
          renderHistory();
        }
      });

      actions.appendChild(pdf);
      actions.appendChild(del);
      row.appendChild(main);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function loadRecord(record){
    if(confirm("この履歴を入力画面へ読み込みますか？")){
      currentDate = record.date;
      PRICES = clone(record.prices || PRICES);
      workers = clone(record.workers);
      workers.push(newWorker());
      saveJSON(STORAGE.prices,PRICES);
      autoSave();
      render();
      window.scrollTo({top:0,behavior:"smooth"});
    }
  }

  function openSettings(){
    var fields = document.getElementById("settingsFields");
    fields.innerHTML = "";
    PRICES.forEach(function(item){
      var row = document.createElement("div");
      row.className = "setting-row";
      row.innerHTML =
        '<label for="price-'+item.key+'">'+escapeHTML(item.label)+'</label>'+
        '<input id="price-'+item.key+'" type="number" min="0" step="100" value="'+item.price+'">';
      fields.appendChild(row);
    });
    document.getElementById("settingsDialog").showModal();
  }

  function saveSettings(){
    PRICES.forEach(function(item){
      var value = Number(document.getElementById("price-"+item.key).value);
      if(!Number.isFinite(value) || value<0){
        alert(item.label+"の単価を正しく入力してください。");
        throw new Error("invalid price");
      }
      item.price = value;
    });
    saveJSON(STORAGE.prices,PRICES);
    document.getElementById("settingsDialog").close();
    autoSave();
    render();
  }

  function printCurrent(){
    var valid = validWorkers();
    if(valid.length===0){
      alert("PDFに出力できる運転手がいません。");
      return;
    }
    printRecord({
      date:currentDate,
      workers:valid,
      prices:clone(PRICES),
      total:valid.reduce(function(sum,w){return sum+workerTotal(w);},0)
    });
  }

  function printRecord(record){
    var priceSet = record.prices || PRICES;
    var sections = record.workers.map(function(worker){
      var rows = Object.keys(worker.counts).filter(function(key){
        return Number(worker.counts[key])>0;
      }).map(function(key){
        var item = priceSet.find(function(p){return p.key===key;});
        var count = Number(worker.counts[key]);
        return "<tr><td>"+escapeHTML(item.label)+"</td><td>"+count+"回</td><td>"+
          formatYen(item.price)+"</td><td>"+formatYen(count*item.price)+"</td></tr>";
      }).join("");

      var total = workerTotal(worker,priceSet);
      return '<section class="person"><h2>'+escapeHTML(worker.name)+'</h2>'+
        '<table><thead><tr><th>項目</th><th>回数</th><th>単価</th><th>小計</th></tr></thead>'+
        '<tbody>'+rows+'</tbody></table><div class="person-total">合計 '+formatYen(total)+'</div></section>';
    }).join("");

    var popup = window.open("","_blank");
    if(!popup){
      alert("ポップアップがブロックされました。Safariの設定で許可してください。");
      return;
    }

    popup.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>集計_'+record.date+'</title>'+
      '<style>body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif;color:#111;margin:28px}'+
      'h1{font-size:24px;margin:0 0 4px}.date{margin-bottom:20px}.person{break-inside:avoid;margin-bottom:22px}'+
      '.person h2{font-size:19px;border-bottom:2px solid #111;padding-bottom:5px}table{width:100%;border-collapse:collapse}'+
      'th,td{border:1px solid #999;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}'+
      '.person-total{text-align:right;font-size:18px;font-weight:bold;margin-top:8px}.grand{border-top:3px double #111;'+
      'margin-top:22px;padding-top:12px;text-align:right;font-size:25px;font-weight:bold}.help{font-size:12px;color:#555;margin-top:20px}'+
      '@media print{.help{display:none}}</style></head><body><h1>集計アプリ</h1>'+
      '<div class="date">日付：'+record.date.replaceAll("-","/")+'</div>'+sections+
      '<div class="grand">総合計 '+formatYen(record.total)+'</div>'+
      '<div class="help">印刷画面で「PDFとして保存」を選択してください。</div>'+
      '<script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script></body></html>');
    popup.document.close();
  }

  function escapeHTML(value){
    return String(value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];
    });
  }

  workDateEl.value = currentDate;

  workDateEl.addEventListener("change",function(){
    var next = workDateEl.value;
    if(next===currentDate){return;}
    if(validWorkers().length>0 && !confirm("日付を変更すると名前と回数をリセットします。よろしいですか？")){
      workDateEl.value = currentDate;
      return;
    }
    currentDate = next;
    workers = [newWorker()];
    autoSave();
    render();
  });

  document.getElementById("addWorkerBtn").addEventListener("click",addWorker);
  document.getElementById("resetBtn").addEventListener("click",resetAll);
  document.getElementById("saveBtn").addEventListener("click",saveHistory);
  document.getElementById("pdfBtn").addEventListener("click",printCurrent);
  document.getElementById("settingsBtn").addEventListener("click",openSettings);
  document.getElementById("saveSettingsBtn").addEventListener("click",function(){
    try{ saveSettings(); }catch(e){}
  });
  document.getElementById("historySearch").addEventListener("input",renderHistory);

  render();
  if(updatedAt){ renderStatus("自動保存"); }
})();