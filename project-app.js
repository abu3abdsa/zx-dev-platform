// متغير يحاكي حالة تسجيل دخول المستخدم (يتم ربطه لاحقاً بـ Node.js/Express)
let isUserLoggedIn = false; 

// دالة محاولة التحميل
function attemptDownload() {
    if (isUserLoggedIn) {
        // إذا كان مسجلاً، يبدأ التحميل
        alert("جاري تجهيز روابط التحميل...");
        // window.location.href = "/download/route"; 
    } else {
        // إذا لم يكن مسجلاً، يظهر الـ Error كما طلبت
        document.getElementById("error-modal").style.display = "flex";
    }
}

// دالة إغلاق نافذة الخطأ
function closeModal() {
    document.getElementById("error-modal").style.display = "none";
}

// إغلاق النافذة عند الضغط خارجها
window.onclick = function(event) {
    const modal = document.getElementById("error-modal");
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// دالة تغيير صورة العرض عند الضغط على المصغرات
function changeImage(element) {
    // تحديث الصورة الرئيسية
    const mainImg = document.getElementById("current-image");
    mainImg.src = element.src;
    
    // تحديث تأثير الحدود (Active) على المصغرات
    const thumbs = document.querySelectorAll(".thumb");
    thumbs.forEach(thumb => thumb.classList.remove("active"));
    element.classList.add("active");
}