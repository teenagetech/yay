import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  remove,
  get,
  runTransaction,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-database.js";
import { getAuth, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiaR6mgdPmEJoB2bGrKMKqZ1IhGcqNpHw",
  authDomain: "yay-cryptocurrency.firebaseapp.com",
  databaseURL: "https://yay-cryptocurrency-default-rtdb.firebaseio.com",
  projectId: "yay-cryptocurrency",
  storageBucket: "yay-cryptocurrency.firebasestorage.app",
  messagingSenderId: "462460388463",
  appId: "1:462460388463:web:40b65a6c7b1d4f9aacb99a",
  measurementId: "G-JKZTHG965Q"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

let licenseAgreements = []

fetch('/licenseAgreements.json')
  .then(response => response.json())
  .then(data => {
    licenseAgreements = data.agreements
  })
  .catch(error => console.error("Error loading license agreements:", error))


let currentPrice = 100;
let userBalance = 1000;
let userShares = 0;
let uid = null;
let accountUID = null;

if (localStorage.getItem("accountUID")) {
  accountUID = localStorage.getItem("accountUID");
  console.log("Loaded accountUID from localStorage:", accountUID);
}
if (!accountUID) {
  signInAnonymously(auth)
    .then((cred) => {
      accountUID = cred.user.uid;
      console.log("Anonymous account created:", accountUID);
      loadUserData();
    })
    .catch((error) => {
      console.error("Auth Error:", error);
    });
} else {
  loadUserData();
}

const connectedRef = ref(db, ".info/connected");
onValue(connectedRef, (snap) => {
  if (!snap.val()) return;
  const conRef = push(ref(db, "activeUsers"));
  set(conRef, true);
  onDisconnect(conRef).remove();
});
onValue(ref(db, "activeUsers"), (snapshot) => {
  const numActiveUsers = snapshot.exists()
    ? Object.keys(snapshot.val() || {}).length
    : 0;
  document.getElementById("activeUsersCount").innerText = numActiveUsers;
});

const externalTooltipHandler = (context) => {
  let tooltipEl = document.getElementById("chartjs-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "chartjs-tooltip";
    document.body.appendChild(tooltipEl);
  }

  const tooltipModel = context.tooltip;

  if (tooltipModel.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  let innerHtml = `<div style="display: flex; align-items: center;">
    <img src="yay.svg" alt="yay logo" style="width:20px; height:20px; margin-right: 3px; margin-top: 5px;" oncontextmenu="return false;">
    <span style="margin-right: 5px;">value:</span>
    <img src="meaning.svg" alt="meaning icon" style="width:16px; height:16px; margin-left: -2px; margin-right: -1px; margin-top: 2px;" class="meaning-icon-sm" oncontextmenu="return false;">
    <span>${parseFloat(tooltipModel.dataPoints[0].raw).toFixed(2)}</span>
  </div>`;

  tooltipEl.innerHTML = innerHtml;

  const canvasRect = context.chart.canvas.getBoundingClientRect();
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = canvasRect.left + window.pageXOffset + tooltipModel.caretX + 85 + "px";
  tooltipEl.style.top = canvasRect.top + window.pageYOffset + tooltipModel.caretY + 25 + "px";
};


const ctx = document.getElementById("priceChart").getContext("2d");
let chartData = {
  labels: [],
  datasets: [
    {
      label: "value",
      data: [],
      fill: true,
      borderColor: "#00ffff",
      backgroundColor: "rgba(0, 255, 255, 0.1)",
      tension: 0.2,
      pointRadius: 2,
      pointHoverRadius: 5
    }
  ]
};

const priceChart = new Chart(ctx, {
  type: "line",
  data: chartData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: false },
      y: {
        min: Math.floor(currentPrice - 7),
        max: Math.ceil(currentPrice + 7),
        ticks: {
          stepSize: 2,
          callback: function (value) {
            return Math.round(value);
          }
        }
      }
    },
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: externalTooltipHandler
      }
    }
  }
});


function updateButtonSaturation() {
  let basePrice;
  const recentPrices = chartData.datasets[0].data;
  if (recentPrices.length >= 5) {
    basePrice = recentPrices.slice(-5).reduce((sum, p) => sum + p, 0) / 5;
  } else {
    basePrice = currentPrice;
  }

  const priceDiff = currentPrice - basePrice;
  const clampedDiff = Math.max(-30, Math.min(30, priceDiff));
  const adjustment = (clampedDiff / 30) * 450;
  let buySaturation, sellSaturation;
  if (priceDiff < 0) {
    buySaturation = 100 + Math.abs(adjustment);
    sellSaturation = 100 - Math.abs(adjustment);
  } else {
    sellSaturation = 100 + adjustment;
    buySaturation = 100 - adjustment;
  }
  buySaturation = Math.max(50, buySaturation);
  sellSaturation = Math.max(50, sellSaturation);

  const buyFilterValue = `saturate(${buySaturation}%)`;
  const sellFilterValue = `saturate(${sellSaturation}%)`;
  const buyBtn = document.getElementById("buyBtn");
  const sellBtn = document.getElementById("sellBtn");
  buyBtn.style.filter = buyFilterValue;
  buyBtn.style.webkitFilter = buyFilterValue;
  sellBtn.style.filter = sellFilterValue;
  sellBtn.style.webkitFilter = sellFilterValue;

  buyBtn.style.transform = "translateZ(0)";
  sellBtn.style.transform = "translateZ(0)";

  if (userBalance < currentPrice) {
    buyBtn.classList.add("disabled");
  } else {
    buyBtn.classList.remove("disabled");
  }

  if (userShares <= 0) {
    sellBtn.classList.add("disabled");
  } else {
    sellBtn.classList.remove("disabled");
  }
}


function updateUI() {
  document.getElementById("currentPrice").innerText = currentPrice.toFixed(2);
  document.getElementById("userBalance").innerText = userBalance.toFixed(2);
  document.getElementById("userShares").innerText = Math.round(userShares);
  updateButtonSaturation();
  priceChart.options.scales.y.min = currentPrice - 7;
  priceChart.options.scales.y.max = currentPrice + 7;
  priceChart.update();
}

function logPriceHistory(price) {
  const timestamp = Date.now();
  push(ref(db, "yayHistory"), { timestamp, price });

  chartData.labels.push(new Date(timestamp).toLocaleTimeString());
  chartData.datasets[0].data.push(price);

  if (chartData.labels.length > 20) {
    chartData.labels.shift();
    chartData.datasets[0].data.shift();
  }
  priceChart.update();
}
setInterval(() => {
  const timestamp = Date.now();
  chartData.labels.push(new Date(timestamp).toLocaleTimeString());
  chartData.datasets[0].data.push(currentPrice);
  if (chartData.labels.length > 20) {
    chartData.labels.shift();
    chartData.datasets[0].data.shift();
  }
  priceChart.update();
}, 2000);
onValue(ref(db, "yayPrice"), (snapshot) => {
  const priceFromDB = snapshot.val();
  if (priceFromDB !== null) {
    currentPrice = priceFromDB;
    updateUI();
  }
});

signInAnonymously(auth)
  .then((cred) => {
    uid = cred.user.uid;
    const userRef = ref(db, "users/" + uid);
    get(userRef).then((snapshot) => {
      if (!snapshot.exists()) {
        set(userRef, { balance: 1000, shares: 0 });
      } else {
        const userData = snapshot.val();
        userBalance = userData.balance;
        userShares = userData.shares;
        console.log("User data loaded:", userData);
        updateUI();
      }
    });
  })
  .catch((error) => {
    console.error("Auth Error: ", error);
  });

function updateUserData() {
  if (accountUID) {
    const userRef = ref(db, "users/" + accountUID);
    runTransaction(userRef, (userData) => {
      if (userData === null) {
        return { balance: userBalance, shares: userShares };
      } else {
        userData.balance = userBalance;
        userData.shares = userShares;
        return userData;
      }
    })
      .then((result) => {
        if (result.committed) {
          console.log("User data updated successfully");
        } else {
          console.error("Transaction not committed");
        }
        updateUI();
      })
      .catch((error) => {
        console.error("Error updating user data:", error);
        updateUI();
      });
  }
}

function buyShare() {
  if (userBalance < currentPrice) {
    showAlert("You don't have enough", true, " to buy a share.");
    return;
  }
  const priceRef = ref(db, "yayPrice");
  runTransaction(priceRef, (current) => {
    if (current === null) current = 100;
    return current * 1.005;
  })
    .then((result) => {
      if (result.committed) {
        userBalance -= currentPrice;
        userShares += 1;
        currentPrice = result.snapshot.val();
        logPriceHistory(currentPrice);
        updateUserData();
        updateUI();
      }
    })
    .catch((error) => {
      console.error("Transaction failed:", error);
    });
}

function sellShare() {
  if (userShares <= 0) {
    showAlert("You don't have any shares to sell.");
    return;
  }
  const priceRef = ref(db, "yayPrice");
  runTransaction(priceRef, (current) => {
    if (current === null) current = 100;
    return current * 0.995;
  })
    .then((result) => {
      if (result.committed) {
        userBalance += currentPrice;
        userShares -= 1;
        currentPrice = result.snapshot.val();
        logPriceHistory(currentPrice);
        updateUserData();
        updateUI();
      }
    })
    .catch((error) => {
      console.error("Transaction failed:", error);
    });
}

function showAlert(message, showMeaning, message2) {
  const alertMessage = document.getElementById("alertMessage");
  if (showMeaning) {
    alertMessage.innerHTML =
      message +
      '<span style="display:inline-flex; align-items:baseline;">' +
      '<img src="meaning.svg" alt="m" draggable="false" style="position: relative; top: 4.7px; left: 1px; vertical-align: baseline; width: 1.08em; height: 1.08em; filter: hue-rotate(120deg) invert(1)">' +
      'eaning' +
      '</span>' +
      message2;
  } else {
    alertMessage.innerText = message;
  }
  const alertEl = document.getElementById("customAlert");
  alertEl.classList.add("visible");
}


document.getElementById("alertCloseBtn").addEventListener("click", () => {
  document.getElementById("customAlert").classList.remove("visible");
});
get(ref(db, "yayPrice")).then((snapshot) => {
  if (!snapshot.exists()) {
    set(ref(db, "yayPrice"), 100);
  }
});

document.getElementById("buyBtn").addEventListener("click", buyShare);
document.getElementById("sellBtn").addEventListener("click", sellShare);
function loadUserData() {
  const userRef = ref(db, "users/" + accountUID);
  get(userRef).then((snapshot) => {
    if (!snapshot.exists()) {
      set(userRef, { balance: 1000, shares: 0 });
      userBalance = 1000;
      userShares = 0;
    } else {
      const userData = snapshot.val();
      userBalance = userData.balance;
      userShares = userData.shares;
    }
    updateUI();
  });
}
document.getElementById("copyUIDBtn").addEventListener("click", () => {
  if (accountUID) {
    navigator.clipboard.writeText(accountUID)
      .then(() => {
        showAlert("User ID copied to clipboard.", false);
      })
      .catch((error) => {
        console.error("Copy failed:", error);
      });
  }
});

document.getElementById("downloadUIDBtn").addEventListener("click", () => {
  if (accountUID) {
    const blob = new Blob([accountUID], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yay User ID.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
});

function login() {
  const pastedUID = document.getElementById("loginUID").value.trim();
  if (!pastedUID) {
    showAlert("Hey! It doesn't look like you've entered a User ID.", false);
    return;
  }
  get(ref(db, "users/" + pastedUID))
    .then((snapshot) => {
      if (!snapshot.exists()) {
        showAlert("That User ID doesn't exist. Try double-checking it.", false);
      } else {
        accountUID = pastedUID;
        localStorage.setItem("accountUID", accountUID);
        loadUserData();
        hideAccountModal();
      }
    })
    .catch((error) => {
      console.error("Error checking UID:", error);
    });
}

document.getElementById("loginUID").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    login();
  }
});

document.getElementById("loginBtn").addEventListener("click", () => {
  login();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("accountUID");
  accountUID = null;
  signOut(auth)
    .then(() => {
      return signInAnonymously(auth);
    })
    .then((cred) => {
      accountUID = cred.user.uid;
      loadUserData();
      hideAccountModal();
    })
    .catch((error) => {
      console.error("Sign out error:", error);
    });
});

function showAccountModal() {
  const modal = document.getElementById("accountModal");
  modal.classList.add("visible");
  if (accountUID) {
    document.getElementById("currentUID").value = accountUID;
  } else {
    document.getElementById("currentUID").value = "";
  }
}

function hideAccountModal() {
  const modal = document.getElementById("accountModal");
  modal.classList.remove("visible");
}

document.getElementById("accountBtn").addEventListener("click", showAccountModal);
document.getElementById("closeAccountModalBtn").addEventListener("click", hideAccountModal);

function showLicenseModal() {
  if (!licenseAgreements.length) {
    console.error("License agreements not loaded yet")
    return
  }
  const modal = document.getElementById("licenseModal")
  document.getElementById("licenseText").innerText =
    licenseAgreements[Math.floor(Math.random() * licenseAgreements.length)]
  modal.classList.add("visible")
}


function hideLicenseModal() {
  document.getElementById("licenseModal").classList.remove("visible")
}

document.getElementById("licenseBtn").addEventListener("click", showLicenseModal)
document.getElementById("declineLicenseBtn").addEventListener("click", hideLicenseModal)
document.getElementById("acceptLicenseBtn").addEventListener("click", () => {
  const bonus = 100
  userBalance += bonus
  updateUserData()
  updateUI()
  hideLicenseModal()
  showAlert(`Congrats, you earned ${bonus}`, true, "!")
});