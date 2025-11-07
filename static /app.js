document.addEventListener('DOMContentLoaded', () => {
    const burgerBtn = document.querySelector('.burger-menu-btn');
    const navMenu = document.querySelector('.navigation-menu');

    // Логика переключения бургер-меню
    if (burgerBtn && navMenu) {
        burgerBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            burgerBtn.classList.toggle('active');
        });
    }

    // Здесь больше не должно быть логики POS-терминала
});
