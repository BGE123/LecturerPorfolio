document.addEventListener("DOMContentLoaded", function () {
  const top = document.querySelector("top");

  const menuItems = [
    { name: "Dashboard", icon: "fa-table-columns", page: "dashboard" },
    { name: "My Courses", icon: "fa-book-open", page: "courses" },
    { name: "Students", icon: "fa-users", page: "students" },
    { name: "Assignments", icon: "fa-calendar-check", page: "assignments" },
    { name: "About", icon: "fa-circle-info", page: "about" },
  ];

  const navContainer = document.querySelector(".nav-links");

  const navHTML = menuItems
    .map((item, index) => {
      const activeClass = index === 0 ? 'class="active"' : "";
      return `
            <li ${activeClass}>
                <span
                class="left-side absolute left-0 h-11 w-1 bg-parallexGold rounded-r-md"
                ></span>
                <a href="#" data-page="${item.page}">
                    <i class="fa-solid ${item.icon}"></i> ${item.name}
                </a>
            </li>
        `;
    })
    .join("");

  navContainer.innerHTML = navHTML;

  const dateElement = document.getElementById("current-date");
  if (dateElement) {
    const options = { year: "numeric", month: "long", day: "numeric" };
    dateElement.textContent = new Date().toLocaleDateString("en-US", options);
  }

  const navLinks = document.querySelectorAll(".nav-links a");
  const navLis = document.querySelectorAll(".nav-links li");
  const pages = document.querySelectorAll(".page-content");
  const pageTitle = document.querySelector(".top");

  if (pageTitle) {
    pageTitle.textContent = menuItems[0].name;
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();

      const pageId = this.getAttribute("data-page");

      const activeItem = menuItems.find((item) => item.page === pageId);
      if (pageTitle && activeItem) {
        pageTitle.textContent = activeItem.name;
      }
      pages.forEach((page) => {
        if (page.id === "page-" + pageId) {
          page.classList.add("active");
        } else {
          page.classList.remove("active");
        }
      });

      navLis.forEach((li) => li.classList.remove("active"));
      this.parentElement.classList.add("active");
    });
  });

  const innerTabs = document.querySelectorAll(".inner-tab");
  const innerPanels = document.querySelectorAll(".inner-panel");

  innerTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      innerTabs.forEach((t) => t.classList.remove("active"));

      this.classList.add("active");

      innerPanels.forEach((panel) => panel.classList.remove("active"));

      const targetId = this.getAttribute("data-subtab");
      const targetPanel = document.getElementById("subtab-" + targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  });
});
