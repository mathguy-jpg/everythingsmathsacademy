document.addEventListener("DOMContentLoaded", function () {

    const homeLink = document.querySelector('a[href="#"]');
    const whyLink = document.querySelector('a[href="#why-choose-us"]');

    if (whyLink) {
        whyLink.addEventListener("click", function (e) {
            e.preventDefault();

            const section = document.getElementById("why-choose-us");

            section.scrollIntoView({
                behavior: "smooth",
                inline: "start",
                block: "nearest"
            });
        });
    }

});