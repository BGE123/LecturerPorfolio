// Check if user is logged in
const lecturer = JSON.parse(sessionStorage.getItem('lecturer'));
if (!lecturer) {
  window.location.href = 'login.html';
}

console.log('Logged in lecturer:', lecturer);

// Load dashboard data on page load
document.addEventListener("DOMContentLoaded", async function () {
  console.log('DOM loaded, loading dashboard data...');
  
  // Update welcome name immediately from sessionStorage
  const welcomeNameEl = document.getElementById('welcome-name');
  if (welcomeNameEl) {
    welcomeNameEl.textContent = lecturer.name;
  }
  
  // Load dashboard data from API
  await loadDashboardData();
  
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
          <span class="left-side absolute left-0 h-11 w-1 bg-parallexGold rounded-r-md"></span>
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
    link.addEventListener("click", async function (e) {
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
      
      // Load data when switching pages
      if (pageId === 'students') {
        await loadStudents();
      } else if (pageId === 'assignments') {
        await loadAssignments();
      } else if (pageId === 'courses') {
        await loadCourses();
      }
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
  
  // Setup announcement form
  setupAnnouncementForm();
});

// API call helper function
async function apiCall(action, data = {}) {
  const body = new URLSearchParams();
  body.append('action', action);
  body.append('data', JSON.stringify(data));
  
  const response = await fetch('/cgi-bin/lecturer_api.py', {
    method: 'POST',
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  
  const text = await response.text();
  console.log('API Response:', text);
  return JSON.parse(text);
}

// Load dashboard data
async function loadDashboardData() {
  try {
    console.log('Loading dashboard for lecturer_id:', lecturer.lecturer_id);
    
    const result = await apiCall('dashboard', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Dashboard result:', result);
    
    if (result.success) {
      // Update stats
      const statValues = document.querySelectorAll('.stat-card .value');
      if (statValues.length >= 3) {
        statValues[0].textContent = result.stats.total_courses;
        statValues[1].textContent = result.stats.total_students;
        statValues[2].textContent = result.stats.pending_marking;
        console.log('Stats updated');
      }
      
      // Update profile initials
      const profilePic = document.querySelector('.profile-pic');
      if (profilePic && result.lecturer.name) {
        const initials = result.lecturer.name.split(' ').map(n => n[0]).join('').substring(0, 2);
        profilePic.textContent = initials;
        console.log('Profile initials updated to:', initials);
      }
      
      // Update courses list on dashboard
      updateCoursesList(result.courses);
      
      // Populate course dropdown
      populateCourseDropdown(result.courses);
      
      console.log('Dashboard loaded successfully');
    } else {
      console.error('Dashboard load failed:', result.message);
      alert('Error loading dashboard: ' + result.message);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    alert('Error loading dashboard. Check console for details.');
  }
}

// Update courses list in dashboard
function updateCoursesList(courses) {
  const container = document.querySelector('.recent-activity');
  if (!container) {
    console.error('Could not find .recent-activity container');
    return;
  }
  
  const existingHeader = container.querySelector('.section-header');
  
  let html = '';
  const icons = ['fa-code', 'fa-database', 'fa-globe', 'fa-laptop-code', 'fa-brain'];
  const colors = ['green', 'purple', 'orange', 'blue', 'red'];
  
  if (courses.length === 0) {
    html = '<p>No courses found.</p>';
  } else {
    courses.forEach((course, index) => {
      const icon = icons[index % icons.length];
      const color = colors[index % colors.length];
      
      html += `
        <div class="list-item">
          <div class="icon-box ${color}">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="info">
            <h4>${course.course_code}</h4>
            <p>${course.title}</p>
          </div>
          <div class="status">
            <span class="badge success">${course.student_count || 0} Students</span>
          </div>
        </div>
      `;
    });
  }
  
  container.innerHTML = '';
  if (existingHeader) {
    container.appendChild(existingHeader);
  }
  container.innerHTML += html;
  console.log('Courses list updated with', courses.length, 'courses');
}

// Populate course dropdown for announcements
function populateCourseDropdown(courses) {
  const select = document.querySelector('.quick-action-card select');
  if (!select) {
    console.error('Could not find course select dropdown');
    return;
  }
  
  if (courses.length === 0) {
    select.innerHTML = '<option>No courses available</option>';
  } else {
    select.innerHTML = courses.map(c => 
      `<option value="${c.course_id}">${c.course_code} - ${c.title}</option>`
    ).join('');
  }
  console.log('Course dropdown populated with', courses.length, 'courses');
}

// Load students
async function loadStudents() {
  try {
    console.log('Loading students...');
    const result = await apiCall('students', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Students result:', result);
    
    if (result.success) {
      const tbody = document.querySelector('#page-students tbody');
      if (tbody) {
        if (result.students.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4">No students found.</td></tr>';
        } else {
          tbody.innerHTML = result.students.map(s => `
            <tr>
              <td>${s.matric_no}</td>
              <td>${s.full_name}</td>
              <td>${s.email}</td>
              <td>${s.course_code}</td>
            </tr>
          `).join('');
        }
        console.log('Students loaded:', result.students.length);
      }
    } else {
      console.error('Failed to load students:', result.message);
      alert('Error loading students: ' + result.message);
    }
  } catch (error) {
    console.error('Error loading students:', error);
    alert('Error loading students. Check console.');
  }
}

// Load assignments
async function loadAssignments() {
  try {
    console.log('Loading assignments...');
    const result = await apiCall('assignments', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Assignments result:', result);
    
    if (result.success) {
      const container = document.querySelector('#page-assignments .card');
      if (container) {
        if (result.assignments.length === 0) {
          container.innerHTML = '<h3>No assignments found.</h3>';
        } else {
          let html = '<h3>Assignments Overview</h3>';
          html += '<table class="styled-table"><thead><tr><th>Course</th><th>Assignment</th><th>Due Date</th><th>Submissions</th><th>Pending</th></tr></thead><tbody>';
          
          result.assignments.forEach(a => {
            const dueDate = a.due_date ? new Date(a.due_date).toLocaleDateString() : 'N/A';
            html += `
              <tr>
                <td>${a.course_code}</td>
                <td>${a.title}</td>
                <td>${dueDate}</td>
                <td>${a.total_submissions || 0}</td>
                <td>${a.pending_grading || 0}</td>
              </tr>
            `;
          });
          
          html += '</tbody></table>';
          container.innerHTML = html;
        }
        console.log('Assignments loaded:', result.assignments.length);
      }
    } else {
      console.error('Failed to load assignments:', result.message);
      alert('Error loading assignments: ' + result.message);
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    alert('Error loading assignments. Check console.');
  }
}

// Load courses page
async function loadCourses() {
  try {
    console.log('Loading courses page...');
    const result = await apiCall('courses', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Courses result:', result);
    
    if (result.success) {
      const grid = document.querySelector('#page-courses .simple-grid');
      if (grid) {
        if (result.courses.length === 0) {
          grid.innerHTML = '<p>No courses found.</p>';
        } else {
          let html = result.courses.map(c => `
            <div class="card">
              <h4>${c.course_code}: ${c.title}</h4>
              <p>${c.student_count || 0} Students</p>
              <p>Level ${c.level}, ${c.assignment_count || 0} Assignments</p>
            </div>
          `).join('');
          
          html += `
            <div class="card add-new-card">
              <i class="fa-solid fa-plus"></i>
              <p>Create New Course</p>
            </div>
          `;
          
          grid.innerHTML = html;
        }
        console.log('Courses page loaded:', result.courses.length);
      }
    } else {
      console.error('Failed to load courses:', result.message);
      alert('Error loading courses: ' + result.message);
    }
  } catch (error) {
    console.error('Error loading courses:', error);
    alert('Error loading courses. Check console.');
  }
}

// Setup announcement form
function setupAnnouncementForm() {
  const form = document.querySelector('.quick-action-card form');
  if (!form) {
    console.error('Could not find announcement form');
    return;
  }
  
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const select = form.querySelector('select');
    const titleInput = form.querySelector('input[type="text"]');
    const messageTextarea = form.querySelector('textarea');
    
    const courseId = select.value;
    const title = titleInput.value;
    const message = messageTextarea.value;
    
    if (!title || !message) {
      alert('Please fill in both title and message');
      return;
    }
    
    console.log('Sending announcement:', { courseId, title, message });
    
    try {
      const result = await apiCall('announcement', {
        lecturer_id: lecturer.lecturer_id,
        course_id: courseId,
        title: title,
        message: message
      });
      
      console.log('Announcement result:', result);
      
      if (result.success) {
        alert('Announcement sent successfully!');
        form.reset();
      } else {
        alert('Error: ' + result.message);
      }
    } catch (error) {
      console.error('Error sending announcement:', error);
      alert('Error sending announcement. Check console.');
    }
  });
  
  console.log('Announcement form setup complete');

  // Add new course
  const addCourseBtn = document.getElementById('addCourse');
  if (addCourseBtn) {
    addCourseBtn.addEventListener('click', function() {
      addNewCourse();
    });
  }
async function addNewCourse() {
  const courseCode = prompt('Enter course code (e.g., COSC401):');
  if (!courseCode) return;
  
  const title = prompt('Enter course title (e.g., Advanced Programming):');
  if (!title) return;
  
  const level = prompt('Enter level (e.g., 400):');
  if (!level) return;
  
  try {
    console.log('Adding new course:', { courseCode, title, level });
    
    const result = await apiCall('add_course', {
      lecturer_id: lecturer.lecturer_id,
      course_code: courseCode,
      title: title,
      level: level
    });
    
    console.log('Add course result:', result);
    
    if (result.success) {
      alert('Course created successfully!');
      // Reload courses page
      await loadCourses();
      // Reload dashboard data to update stats
      await loadDashboardData();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error adding course:', error);
    alert('Error adding course. Check console.');
  }
}
}
