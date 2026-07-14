(function(){
  "use strict";

  var PRICES = [
    {key:"yokohama20", label:"横浜20F", price:15500},
    {key:"yokohama40", label:"横浜40F", price:20500},
    {key:"tokyo20", label:"東京20F", price:13000},
    {key:"tokyo40", label:"東京40F", price:18000}
  ];

  var workersEl = document.getElementById("workers");
  var grandTotalEl = document.getElementById("grandTotal");
  var workDateEl = document.getElementById("workDate");
  var workers = [];

  function formatYen(value){
    return Number(value || 0).toLocaleString("ja-JP") + "円";
  }

  function todayValue(){
    var d = new Date();
    var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,10);
  }

  function newWorker(){
    return {
      id:String(Date.now()) + Math.random().toString(36).slice(2),
      name:"",
      counts:{yokohama20:0,yokohama40:0,tokyo20:0,tokyo40:0}
    };
  }

  function workerTotal(worker){
    var total = 0;
    PRICES.forEach(function(item){
      total += Number(worker.counts[item.key] || 0) * item.price;
    });
    return total;
  }

  function ensureLastBlank(){
    if(workers.length === 0){
      workers.push(newWorker());
      return;
    }
    var last = workers[workers.length - 1];
    var hasCount = Object.keys(last.counts).some(function(key){
      return Number(last.counts[key]) > 0;
    });
    if(last.name.trim() !== "" || hasCount){
      workers.push(newWorker());
    }
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
        if(index === workers.length - 1 && worker.name.trim() !== ""){
          workers.push(newWorker());
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
        count.textContent = String(worker.counts[item.key]);

        var plus = document.createElement("button");
        plus.type = "button";
        plus.className = "plus";
        plus.textContent = "＋";

        minus.addEventListener("click",function(){
          worker.counts[item.key] = Math.max(0,Number(worker.counts[item.key]) - 1);
          render();
        });

        plus.addEventListener("click",function(){
          worker.counts[item.key] = Number(worker.counts[item.key]) + 1;
          if(index === workers.length - 1){
            workers.push(newWorker());
          }
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
      total.innerHTML = "<span>運転手合計</span><strong>" + formatYen(workerTotal(worker)) + "</strong>";
      card.appendChild(total);

      if(index < workers.length - 1){
        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove";
        remove.textContent = "この運転手を削除";
        remove.addEventListener("click",function(){
          workers = workers.filter(function(w){ return w.id !== worker.id; });
          render();
        });
        card.appendChild(remove);
      }

      workersEl.appendChild(card);
    });

    var grand = workers.reduce(function(sum,worker){
      return sum + workerTotal(worker);
    },0);
    grandTotalEl.textContent = formatYen(grand);
  }

  workDateEl.value = todayValue();

  workDateEl.addEventListener("change",function(){
    if(confirm("日付を変更すると入力内容をリセットします。よろしいですか？")){
      workers = [newWorker()];
      render();
    }
  });

  document.getElementById("addWorkerBtn").addEventListener("click",function(){
    var last = workers[workers.length - 1];
    var isBlank = last &&
      last.name.trim() === "" &&
      Object.keys(last.counts).every(function(key){ return Number(last.counts[key]) === 0; });

    if(!isBlank){
      workers.push(newWorker());
    }
    render();

    var fields = document.querySelectorAll(".worker-name");
    if(fields.length){
      fields[fields.length - 1].focus();
    }
  });

  document.getElementById("resetBtn").addEventListener("click",function(){
    if(confirm("全員の入力内容をリセットしますか？")){
      workers = [newWorker()];
      render();
    }
  });

  document.getElementById("saveBtn").addEventListener("click",function(){
    alert("保存機能は次のバージョンで追加します。");
  });

  document.getElementById("pdfBtn").addEventListener("click",function(){
    alert("PDF機能は次のバージョンで追加します。");
  });

  workers = [newWorker()];
  render();
})();
