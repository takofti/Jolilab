let currentTranslations = {};

async function loadLanguage(lang) {
    try {
        const fileName = lang.charAt(0).toUpperCase() + lang.slice(1); // en -> En, ru -> Ru
        const response = await fetch(`/Frontend/public/language/${fileName}.json`);
        if (!response.ok) throw new Error(`Не удалось загрузить ${fileName}.json`);
        currentTranslations = await response.json();
    } catch (err) {
        console.error("Ошибка загрузки перевода:", err);
        return;
    }

    document.querySelectorAll("[data-lang-key]").forEach(element => {
        const key = element.dataset.langKey;
        if (currentTranslations[key] !== undefined) {
            element.textContent = currentTranslations[key];
        }
    });

    document.querySelectorAll("[data-lang-placeholder]").forEach(element => {
        const key = element.dataset.langPlaceholder;
        if (currentTranslations[key] !== undefined) {
            element.setAttribute("placeholder", currentTranslations[key]);
        }
    });

    document.querySelectorAll("[data-lang-title]").forEach(element => {
        const key = element.dataset.langTitle;
        if (currentTranslations[key] !== undefined) {
            element.setAttribute("title", currentTranslations[key]);
        }
    });

    localStorage.setItem("language", lang);
    document.documentElement.lang = lang;

    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.langSelect === lang);
    });

    const select = document.getElementById("language");
    if (select) select.value = lang;
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            loadLanguage(btn.dataset.langSelect);
        });
    });

    const select = document.getElementById("language");
    if (select) {
        select.addEventListener("change", (e) => {
            loadLanguage(e.target.value);
        });
    }

    loadLanguage(localStorage.getItem("language") || "ru");
});