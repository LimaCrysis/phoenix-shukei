(function(){
  "use strict";

  // Ver.2.3.0: 古いPWAキャッシュが残っている場合は自動的に削除します。
  if("serviceWorker" in navigator){
    navigator.serviceWorker.getRegistrations().then(function(registrations){
      registrations.forEach(function(registration){ registration.unregister(); });
    }).catch(function(){});
  }
  if("caches" in window){
    caches.keys().then(function(keys){
      keys.forEach(function(key){ caches.delete(key); });
    }).catch(function(){});
  }

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
  var workDateEl = document.getElementById("workDate");
  var saveStatusEl = document.getElementById("saveStatus");

  var PRICES = loadJSON(STORAGE.prices, DEFAULT_PRICES);
  var draft = loadJSON(STORAGE.draft, null);
  var workers = draft && draft.workers ? draft.workers : [newWorker()];
  var currentDate = draft && draft.date ? draft.date : todayValue();
  var updatedAt = draft && draft.updatedAt ? draft.updatedAt : null;

  function clone(value){ return JSON.parse(JSON.stringify(value)); }

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

  function newPlaceKey(){
    return "place_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
  }

  function newWorker(){
    var counts = {};
    PRICES.forEach(function(item){ counts[item.key] = 0; });
    return {id:uid(),name:"",counts:counts};
  }

  function normalizeWorkers(){
    workers.forEach(function(worker){
      if(!worker.counts) worker.counts = {};
      PRICES.forEach(function(item){
        if(typeof worker.counts[item.key] === "undefined") worker.counts[item.key] = 0;
      });
      Object.keys(worker.counts).forEach(function(key){
        if(!PRICES.some(function(item){return item.key===key;})){
          delete worker.counts[key];
        }
      });
    });
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
      return worker.name.trim() !== "" &&
        Object.keys(worker.counts).some(function(key){return Number(worker.counts[key])>0;});
    });
  }

  function ensureLastBlank(){
    normalizeWorkers();
    if(workers.length===0){workers.push(newWorker());return;}
    while(workers.length>1){
      var last=workers[workers.length-1];
      var prev=workers[workers.length-2];
      var lastBlank=last.name.trim()===""&&Object.keys(last.counts).every(function(k){return Number(last.counts[k])===0;});
      var prevBlank=prev.name.trim()===""&&Object.keys(prev.counts).every(function(k){return Number(prev.counts[k])===0;});
      if(lastBlank&&prevBlank){workers.pop();}else{break;}
    }
    var finalWorker=workers[workers.length-1];
    var hasData=finalWorker.name.trim()!==""||Object.keys(finalWorker.counts).some(function(k){return Number(finalWorker.counts[k])>0;});
    if(hasData){workers.push(newWorker());}
  }

  function autoSave(){
    updatedAt=new Date().toISOString();
    saveJSON(STORAGE.draft,{
      date:currentDate,
      workers:clone(workers),
      updatedAt:updatedAt
    });
    renderStatus("自動保存");
    autoSaveHistory();
  }

  function renderStatus(label){
    if(!updatedAt){saveStatusEl.textContent="未保存";return;}
    var d=new Date(updatedAt);
    saveStatusEl.textContent=(label||"自動保存")+"\n"+
      d.toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  function render(){
    ensureLastBlank();
    workersEl.innerHTML="";

    workers.forEach(function(worker,index){
      var card=document.createElement("section");
      card.className="worker";

      var title=document.createElement("div");
      title.className="worker-title";
      title.textContent="運転手";

      var name=document.createElement("input");
      name.className="worker-name";
      name.type="text";
      name.placeholder="運転手名を入力";
      name.value=worker.name;

      name.addEventListener("input",function(){
        worker.name=name.value;
        autoSave();
        if(index===workers.length-1&&worker.name.trim()!==""){
          ensureLastBlank();render();
          var fields=document.querySelectorAll(".worker-name");
          if(fields[index]){
            fields[index].focus();
            fields[index].setSelectionRange(worker.name.length,worker.name.length);
          }
        }
      });

      card.appendChild(title);
      card.appendChild(name);

      PRICES.forEach(function(item){
        var row=document.createElement("div");
        row.className="task";

        var left=document.createElement("div");
        var taskName=document.createElement("div");
        taskName.className="task-name";
        taskName.textContent=item.label;
        var unit=document.createElement("span");
        unit.className="unit";
        unit.textContent=formatYen(item.price)+" / 本";
        left.appendChild(taskName);
        left.appendChild(unit);

        var counter=document.createElement("div");
        counter.className="counter";

        var minus=document.createElement("button");
        minus.type="button";minus.className="minus";minus.textContent="−";
        var count=document.createElement("span");
        count.className="count";count.textContent=String(worker.counts[item.key]||0);
        var plus=document.createElement("button");
        plus.type="button";plus.className="plus";plus.textContent="＋";

        minus.addEventListener("click",function(){
          worker.counts[item.key]=Math.max(0,Number(worker.counts[item.key]||0)-1);
          autoSave();render();
        });
        plus.addEventListener("click",function(){
          worker.counts[item.key]=Number(worker.counts[item.key]||0)+1;
          autoSave();render();
        });

        counter.appendChild(minus);counter.appendChild(count);counter.appendChild(plus);
        row.appendChild(left);row.appendChild(counter);card.appendChild(row);
      });

      var total=document.createElement("div");
      total.className="worker-total";
      total.innerHTML="<span>運転手合計</span><strong>"+formatYen(workerTotal(worker))+"</strong>";
      card.appendChild(total);

      var isLastBlank=index===workers.length-1&&worker.name.trim()===""&&
        Object.keys(worker.counts).every(function(k){return Number(worker.counts[k])===0;});
      if(!isLastBlank){
        var remove=document.createElement("button");
        remove.type="button";remove.className="remove";remove.textContent="この運転手を削除";
        remove.addEventListener("click",function(){
          if(confirm((worker.name||"この運転手")+"を削除しますか？")){
            workers=workers.filter(function(w){return w.id!==worker.id;});
            autoSave();render();
          }
        });
        card.appendChild(remove);
      }
      workersEl.appendChild(card);
    });
    workDateEl.value=currentDate;
    renderHistory();
  }

  function addWorker(){
    ensureLastBlank();
    var last=workers[workers.length-1];
    var blank=last.name.trim()===""&&Object.keys(last.counts).every(function(k){return Number(last.counts[k])===0;});
    if(!blank)workers.push(newWorker());
    render();
    var fields=document.querySelectorAll(".worker-name");
    if(fields.length)fields[fields.length-1].focus();
  }

  function resetAll(){
    if(confirm("全員の入力内容をリセットしますか？")){
      workers=[newWorker()];autoSave();render();
    }
  }

  function autoSaveHistory(){
    var valid=validWorkers();
    var history=loadJSON(STORAGE.history,[]);

    // 同じ日付の自動保存データは常に1件へまとめます。
    var existingIndex=history.findIndex(function(record){
      return record.date===currentDate && record.autoSaved===true;
    });

    if(valid.length===0){
      if(existingIndex!==-1){
        history.splice(existingIndex,1);
        saveJSON(STORAGE.history,history);
      }
      renderHistory();
      return;
    }

    var record={
      id:existingIndex!==-1 ? history[existingIndex].id : uid(),
      date:currentDate,
      workers:clone(valid),
      prices:clone(PRICES),
      total:valid.reduce(function(sum,w){return sum+workerTotal(w);},0),
      savedAt:new Date().toISOString(),
      autoSaved:true
    };

    if(existingIndex!==-1){
      history[existingIndex]=record;
    }else{
      history.unshift(record);
    }

    history.sort(function(a,b){
      return String(b.date).localeCompare(String(a.date)) ||
        String(b.savedAt||"").localeCompare(String(a.savedAt||""));
    });

    saveJSON(STORAGE.history,history);
    renderHistory();
  }

  function renderHistory(){
    var list=document.getElementById("historyList");
    var query=document.getElementById("historySearch").value.trim().toLowerCase();
    var history=loadJSON(STORAGE.history,[]);
    var filtered=history.filter(function(record){
      var names=record.workers.map(function(w){return w.name;}).join(" ");
      return !query||(record.date+" "+names).toLowerCase().indexOf(query)!==-1;
    });
    document.getElementById("historyCount").textContent=history.length+"件";
    list.innerHTML="";
    if(filtered.length===0){list.innerHTML='<div class="empty">保存履歴はありません</div>';return;}

    filtered.forEach(function(record){
      var row=document.createElement("div");row.className="history-item";
      var main=document.createElement("div");
      main.innerHTML='<div class="history-date">'+record.date.replaceAll("-","/")+'</div>'+
        '<div class="history-names">'+record.workers.map(function(w){return escapeHTML(w.name);}).join("、")+'</div>'+
        '<div class="history-total">'+formatYen(record.total)+'</div>';
      main.addEventListener("click",function(){loadRecord(record);});
      var actions=document.createElement("div");actions.className="history-actions";
      var pdf=document.createElement("button");pdf.className="mini";pdf.type="button";pdf.textContent="PDF";
      pdf.addEventListener("click",function(){createPdf(record);});
      var del=document.createElement("button");del.className="mini";del.type="button";del.textContent="削除";
      del.addEventListener("click",function(){
        if(confirm("この履歴を削除しますか？")){
          saveJSON(STORAGE.history,loadJSON(STORAGE.history,[]).filter(function(r){return r.id!==record.id;}));
          renderHistory();
        }
      });
      actions.appendChild(pdf);actions.appendChild(del);row.appendChild(main);row.appendChild(actions);list.appendChild(row);
    });
  }

  function loadRecord(record){
    if(confirm("この自動保存履歴を入力画面へ読み込みますか？")){
      currentDate=record.date;
      PRICES=clone(record.prices||PRICES);
      workers=clone(record.workers);workers.push(newWorker());
      saveJSON(STORAGE.prices,PRICES);autoSave();render();window.scrollTo({top:0,behavior:"smooth"});
    }
  }

  function persistPlaceSettings(){
    normalizeWorkers();
    saveJSON(STORAGE.prices,clone(PRICES));
    updatedAt=new Date().toISOString();
    saveJSON(STORAGE.draft,{
      date:currentDate,
      workers:clone(workers),
      updatedAt:updatedAt
    });
    renderStatus("自動保存");
    render();
  }

  function showSettingSaved(box,message){
    var status=box.querySelector(".setting-saved");
    if(!status)return;
    status.textContent=message || "保存しました";
    window.setTimeout(function(){
      if(status)status.textContent="";
    },1300);
  }

  function renderSettingsFields(){
    var fields=document.getElementById("settingsFields");
    fields.innerHTML="";

    var label=document.createElement("div");
    label.className="settings-section-label";
    label.textContent="登録済みの場所と単価";
    fields.appendChild(label);

    PRICES.forEach(function(item,index){
      var box=document.createElement("div");
      box.className="setting-place";

      box.innerHTML=
        '<div class="setting-place-grid">'+
          '<div>'+
            '<label for="label-'+index+'">場所名</label>'+
            '<input id="label-'+index+'" class="place-label" type="text" value="'+escapeAttr(item.label)+'">'+
          '</div>'+
          '<div>'+
            '<label for="price-'+index+'">単価</label>'+
            '<input id="price-'+index+'" class="place-price" type="number" inputmode="numeric" min="0" step="100" value="'+item.price+'">'+
          '</div>'+
        '</div>'+
        '<div class="setting-saved" aria-live="polite"></div>';

      var labelInput=box.querySelector(".place-label");
      var priceInput=box.querySelector(".place-price");

      function saveExistingPlace(){
        var nextLabel=labelInput.value.trim();
        var nextPrice=Number(priceInput.value);

        if(!nextLabel){
          alert("場所名を入力してください。");
          labelInput.value=item.label;
          labelInput.focus();
          return;
        }
        if(!Number.isFinite(nextPrice) || nextPrice<0){
          alert(nextLabel+"の単価を正しく入力してください。");
          priceInput.value=item.price;
          priceInput.focus();
          return;
        }
        var duplicate=PRICES.some(function(other,otherIndex){
          return otherIndex!==index && other.label.trim()===nextLabel;
        });
        if(duplicate){
          alert("同じ場所名がすでに登録されています。");
          labelInput.value=item.label;
          labelInput.focus();
          return;
        }

        item.label=nextLabel;
        item.price=nextPrice;
        persistPlaceSettings();
        showSettingSaved(box,"変更を保存しました");
      }

      labelInput.addEventListener("change",saveExistingPlace);
      priceInput.addEventListener("change",saveExistingPlace);
      labelInput.addEventListener("blur",function(){
        if(labelInput.value.trim()!==item.label)saveExistingPlace();
      });
      priceInput.addEventListener("blur",function(){
        if(Number(priceInput.value)!==Number(item.price))saveExistingPlace();
      });

      if(PRICES.length>1){
        var remove=document.createElement("button");
        remove.type="button";
        remove.className="remove-location";
        remove.textContent="この場所を削除";
        remove.addEventListener("click",function(){
          if(!confirm(item.label+"を削除しますか？"))return;

          PRICES.splice(index,1);
          workers.forEach(function(worker){
            if(worker.counts)delete worker.counts[item.key];
          });
          persistPlaceSettings();
          renderSettingsFields();
        });
        box.appendChild(remove);
      }

      fields.appendChild(box);
    });
  }

  function openSettings(){
    renderSettingsFields();

    var nameInput=document.getElementById("newLocationName");
    var priceInput=document.getElementById("newLocationPrice");
    if(nameInput)nameInput.value="";
    if(priceInput)priceInput.value="";

    var dialog=document.getElementById("settingsDialog");
    if(!dialog.open)dialog.showModal();
  }

  function addLocation(){
    var nameInput=document.getElementById("newLocationName");
    var priceInput=document.getElementById("newLocationPrice");
    var label=nameInput.value.trim();
    var price=Number(priceInput.value);

    if(!label){
      alert("追加する場所名を入力してください。");
      nameInput.focus();
      return;
    }
    if(!Number.isFinite(price) || price<0){
      alert("追加する単価を正しく入力してください。");
      priceInput.focus();
      return;
    }
    if(PRICES.some(function(item){return item.label.trim()===label;})){
      alert("同じ場所名がすでに登録されています。");
      nameInput.focus();
      return;
    }

    var key=newPlaceKey();
    PRICES.push({key:key,label:label,price:price});

    workers.forEach(function(worker){
      if(!worker.counts)worker.counts={};
      worker.counts[key]=0;
    });

    persistPlaceSettings();
    renderSettingsFields();

    nameInput.value="";
    priceInput.value="";
    nameInput.focus();

    alert(label+"（"+formatYen(price)+"）を追加しました。");
  }

  function buildPdfSheet(record){
    var priceSet=record.prices||PRICES;
    var sheet=document.createElement("div");sheet.className="pdf-sheet";
    var content='<h1>詳細PDF</h1><div class="pdf-date">日付：'+record.date.replaceAll("-","/")+'</div>';
    record.workers.forEach(function(worker){
      var rows="";
      Object.keys(worker.counts).forEach(function(key){
        var count=Number(worker.counts[key]||0);
        if(count<=0)return;
        var item=priceSet.find(function(p){return p.key===key;});
        if(!item)return;
        rows+='<tr><td>'+escapeHTML(item.label)+'</td><td>'+count+'回</td><td>'+formatYen(item.price)+'</td><td>'+formatYen(count*item.price)+'</td></tr>';
      });
      content+='<section class="pdf-person"><h2>'+escapeHTML(worker.name)+'</h2>'+
        '<table class="pdf-table"><thead><tr><th>項目</th><th>本数</th><th>単価</th><th>小計</th></tr></thead><tbody>'+
        rows+'</tbody></table><div class="pdf-person-total">合計 '+formatYen(workerTotal(worker,priceSet))+'</div></section>';
    });
    content+='<div class="pdf-grand">総合計 '+formatYen(record.total)+'</div>';
    sheet.innerHTML=content;document.body.appendChild(sheet);return sheet;
  }

  async function createPdf(record){
    if(typeof html2canvas==="undefined"||!window.jspdf){
      alert("PDF機能の読み込みに失敗しました。通信状態を確認して再読み込みしてください。");
      return;
    }
    var overlay=document.createElement("div");
    overlay.className="pdf-generating";overlay.innerHTML="<div>PDFを作成しています…</div>";
    document.body.appendChild(overlay);
    var sheet=null;
    try{
      sheet=buildPdfSheet(record);
      var canvas=await html2canvas(sheet,{scale:2,backgroundColor:"#ffffff",useCORS:true});
      var jsPDF=window.jspdf.jsPDF;
      var pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      var pageWidth=210,pageHeight=297,margin=10;
      var usableWidth=pageWidth-margin*2;
      var imageHeight=canvas.height*usableWidth/canvas.width;
      var pageCanvasHeight=canvas.width*(pageHeight-margin*2)/usableWidth;
      var y=0,page=0;
      while(y<canvas.height){
        var sliceHeight=Math.min(pageCanvasHeight,canvas.height-y);
        var part=document.createElement("canvas");
        part.width=canvas.width;part.height=sliceHeight;
        part.getContext("2d").drawImage(canvas,0,y,canvas.width,sliceHeight,0,0,canvas.width,sliceHeight);
        var data=part.toDataURL("image/jpeg",0.95);
        if(page>0)pdf.addPage();
        var partHeight=sliceHeight*usableWidth/canvas.width;
        pdf.addImage(data,"JPEG",margin,margin,usableWidth,partHeight);
        y+=sliceHeight;page++;
      }
      pdf.save("詳細PDF_"+record.date+".pdf");
    }catch(e){
      console.error(e);
      alert("PDFの作成に失敗しました。もう一度お試しください。");
    }finally{
      if(sheet)sheet.remove();
      overlay.remove();
    }
  }

  function printCurrent(){
    var valid=validWorkers();
    if(valid.length===0){alert("PDFに出力できる運転手がいません。");return;}
    createPdf({
      date:currentDate,workers:clone(valid),prices:clone(PRICES),
      total:valid.reduce(function(sum,w){return sum+workerTotal(w);},0)
    });
  }


  function currentMonthValue(){
    var d=new Date();
    var local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return local.toISOString().slice(0,7);
  }

  function openManagement(){
    var monthInput=document.getElementById("managementMonth");
    if(!monthInput.value)monthInput.value=currentMonthValue();
    renderManagement();
    var dialog=document.getElementById("managementDialog");
    if(!dialog.open)dialog.showModal();
  }

  function renderManagement(){
    var month=document.getElementById("managementMonth").value || currentMonthValue();
    var history=loadJSON(STORAGE.history,[]);
    var records=history.filter(function(record){
      return typeof record.date==="string" && record.date.slice(0,7)===month;
    });

    var empty=document.getElementById("managementEmpty");
    var content=document.getElementById("managementContent");

    if(records.length===0){
      empty.style.display="block";
      content.style.display="none";
      return;
    }

    empty.style.display="none";
    content.style.display="block";

    var driverMap={};
    var driverOrder=[];
    var placeMap={};
    var placeOrder=[];
    var totalAmount=0;
    var totalCount=0;
    var dateSet={};

    records.forEach(function(record){
      dateSet[record.date]=true;
      var priceSet=record.prices || PRICES;
      totalAmount+=Number(record.total || 0);

      record.workers.forEach(function(worker){
        var driverName=(worker.name || "").trim();
        if(driverName && !driverMap[driverName]){
          driverMap[driverName]={count:0,amount:0};
          driverOrder.push(driverName);
        }

        Object.keys(worker.counts || {}).forEach(function(key){
          var count=Number(worker.counts[key] || 0);
          if(count<=0)return;

          var place=priceSet.find(function(item){return item.key===key;});
          if(!place)return;

          var amount=count*Number(place.price || 0);
          totalCount+=count;

          if(driverName){
            driverMap[driverName].count+=count;
            driverMap[driverName].amount+=amount;
          }

          if(!placeMap[place.label]){
            placeMap[place.label]={count:0,amount:0};
            placeOrder.push(place.label);
          }
          placeMap[place.label].count+=count;
          placeMap[place.label].amount+=amount;
        });
      });
    });

    document.getElementById("monthlyAmount").textContent=formatYen(totalAmount);
    document.getElementById("monthlyCount").textContent=totalCount.toLocaleString("ja-JP")+"本";
    document.getElementById("monthlyDays").textContent=Object.keys(dateSet).length+"日";

    var driverRows=document.getElementById("driverMonthlyRows");
    driverRows.innerHTML="";
    driverOrder.forEach(function(name){
      var row=document.createElement("tr");
      row.innerHTML="<td>"+escapeHTML(name)+"</td>"+
        "<td>"+driverMap[name].count.toLocaleString("ja-JP")+"本</td>"+
        "<td>"+formatYen(driverMap[name].amount)+"</td>";
      driverRows.appendChild(row);
    });

    var placeRows=document.getElementById("placeMonthlyRows");
    placeRows.innerHTML="";
    placeOrder.forEach(function(label){
      var row=document.createElement("tr");
      row.innerHTML="<td>"+escapeHTML(label)+"</td>"+
        "<td>"+placeMap[label].count.toLocaleString("ja-JP")+"本</td>"+
        "<td>"+formatYen(placeMap[label].amount)+"</td>";
      placeRows.appendChild(row);
    });
  }

  function escapeHTML(value){
    return String(value).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];
    });
  }
  function escapeAttr(value){return escapeHTML(value);}

  workDateEl.value=currentDate;
  workDateEl.addEventListener("change",function(){
    var next=workDateEl.value;
    if(next===currentDate)return;
    if(validWorkers().length>0&&!confirm("日付を変更すると名前と本数をリセットします。よろしいですか？")){
      workDateEl.value=currentDate;return;
    }
    currentDate=next;workers=[newWorker()];autoSave();render();
  });

  document.getElementById("addWorkerBtn").addEventListener("click",addWorker);
  document.getElementById("resetBtn").addEventListener("click",resetAll);
  document.getElementById("pdfBtn").addEventListener("click",printCurrent);
  document.getElementById("settingsBtn").addEventListener("click",openSettings);
  document.getElementById("addLocationBtn").addEventListener("click",addLocation);
  document.getElementById("historySearch").addEventListener("input",renderHistory);
  document.getElementById("managementBtn").addEventListener("click",openManagement);
  document.getElementById("managementMonth").addEventListener("change",renderManagement);
  document.querySelectorAll("[data-close-dialog]").forEach(function(button){
    button.addEventListener("click",function(){
      var dialog=document.getElementById(button.getAttribute("data-close-dialog"));
      if(dialog)dialog.close();
    });
  });

  render();
  if(updatedAt){
    renderStatus("自動保存");
    autoSaveHistory();
  }
})();