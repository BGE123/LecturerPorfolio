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
  
  // Load lecturer profile
  await loadLecturerProfile();
  
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
      } else if (pageId === 'about') {
        await loadLecturerProfile();
        await loadPublications();
      }
    });
  });

  const innerTabs = document.querySelectorAll(".inner-tab");
  const innerPanels = document.querySelectorAll(".inner-panel");

  innerTabs.forEach((tab) => {
    tab.addEventListener("click", async function () {
      innerTabs.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      innerPanels.forEach((panel) => panel.classList.remove("active"));

      const targetId = this.getAttribute("data-subtab");
      const targetPanel = document.getElementById("subtab-" + targetId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
      
      // Load publications when switching to publications tab
      if (targetId === 'publications') {
        await loadPublications();
      }
    });
  });
  
  // Setup announcement form and add course button
  setupAnnouncementForm();
  
  // Mobile menu
  setupMobileMenu();
});

// API call helper function
async function apiCall(action, data = {}) {
  const body = new URLSearchParams();
  body.append('action', action);
  body.append('data', JSON.stringify(data));
  
  const API_URL = "https://lecturerporfolio.onrender.com/lecturer_api.py";
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  
  const text = await response.text();
  console.log('Raw API Response:', text);
  
  // Try to find JSON in the response (in case there's extra output)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse matched JSON:', jsonMatch[0]);
      throw new Error('Server returned invalid JSON');
    }
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON:', text);
    throw new Error('Server returned invalid JSON: ' + text.substring(0, 100));
  }
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
      
      // Update sessionStorage with full lecturer data
      sessionStorage.setItem('lecturer', JSON.stringify(result.lecturer));
      
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

// Load lecturer profile
async function loadLecturerProfile() {
  try {
    console.log('Loading lecturer profile...');
    
    // First, try to get updated data from API
    const result = await apiCall('profile', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Profile result:', result);
    
    let profileData = lecturer; // fallback to sessionStorage data
    
    if (result.success && result.lecturer) {
      profileData = result.lecturer;
      // Update sessionStorage
      sessionStorage.setItem('lecturer', JSON.stringify(profileData));
    }
    
    // Update Overview tab
    const aboutName = document.querySelector('#subtab-overview h3');
    const aboutBio = document.querySelector('#subtab-overview .bio-text');
    const aboutEmail = document.querySelectorAll('.contact-item')[0];
    
    if (aboutName) aboutName.textContent = profileData.name;
    
    if (aboutBio) {
      aboutBio.textContent = profileData.bio || 'No bio available. Update your profile to add a bio.';
    }
    
    if (aboutEmail) {
      aboutEmail.innerHTML = `<i class="fa-solid fa-envelope"></i> ${profileData.email}`;
    }
    
    // Update Education tab
    const educationPanel = document.querySelector('#subtab-education .card');
    if (educationPanel) {
      if (profileData.education && profileData.education.trim()) {
        educationPanel.innerHTML = `
          <h3>Academic Background</h3>
          <div class="info-content">
            ${profileData.education.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
        `;
      } else {
        educationPanel.innerHTML = `
          <h3>Academic Background</h3>
          <p>No education information available. Update your profile to add your academic background.</p>
        `;
      }
    }
    
    // Update Experience tab
    const experiencePanel = document.querySelector('#subtab-experience .card');
    if (experiencePanel) {
      if (profileData.experience && profileData.experience.trim()) {
        experiencePanel.innerHTML = `
          <h3>Professional History</h3>
          <div class="info-content">
            ${profileData.experience.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
        `;
      } else {
        experiencePanel.innerHTML = `
          <h3>Professional History</h3>
          <p>No experience information available. Update your profile to add your professional history.</p>
        `;
      }
    }
    
    console.log('Lecturer profile loaded successfully');
  } catch (error) {
    console.error('Error loading profile:', error);
    // Use fallback data from sessionStorage
    const aboutName = document.querySelector('#subtab-overview h3');
    const aboutEmail = document.querySelectorAll('.contact-item')[0];
    
    if (aboutName) aboutName.textContent = lecturer.name;
    if (aboutEmail) aboutEmail.innerHTML = `<i class="fa-solid fa-envelope"></i> ${lecturer.email}`;
  }
}

// Load publications
async function loadPublications() {
  try {
    console.log('Loading publications...');
    
    const result = await apiCall('publications', { lecturer_id: lecturer.lecturer_id });
    
    console.log('Publications result:', result);
    
    const publicationsPanel = document.querySelector('#subtab-publications .card');
    
    if (publicationsPanel) {
      if (result.success && result.publications && result.publications.length > 0) {
        let html = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Selected Publications</h3>
            <button onclick="addNewPublication()" class="action-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
              <i class="fa-solid fa-plus"></i> Add Publication
            </button>
          </div>
          <ul class="pub-list">
        `;
        
        result.publications.forEach(pub => {
          html += `
            <li style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div style="flex: 1;">
                <a href="${pub.url || '#'}" target="_blank">
                  ${pub.authors} (${pub.year}). <em>${pub.title}.</em> ${pub.journal_conference}.
                </a>
              </div>
              <button onclick="deletePublication(${pub.publication_id})" 
                      class="delete-btn" 
                      style="margin-left: 1rem; padding: 0.3rem 0.6rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                      title="Delete publication">
                <i class="fa-solid fa-trash"></i>
              </button>
            </li>
          `;
        });
        
        html += '</ul>';
        publicationsPanel.innerHTML = html;
      } else {
        publicationsPanel.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Selected Publications</h3>
            <button onclick="addNewPublication()" class="action-btn" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
              <i class="fa-solid fa-plus"></i> Add Publication
            </button>
          </div>
          <p>No publications found. Click the button above to add your first publication.</p>
        `;
      }
    }
    
    console.log('Publications loaded successfully');
  } catch (error) {
    console.error('Error loading publications:', error);
    const publicationsPanel = document.querySelector('#subtab-publications .card');
    if (publicationsPanel) {
      publicationsPanel.innerHTML = `
        <h3>Selected Publications</h3>
        <p>Error loading publications. Please try again.</p>
      `;
    }
  }
}

// Add new publication
async function addNewPublication() {
  const title = prompt('Enter publication title:');
  if (!title) return;
  
  const authors = prompt('Enter authors (e.g., Smith, J. & Doe, A.):');
  if (!authors) return;
  
  const journalConference = prompt('Enter journal/conference name:');
  if (!journalConference) return;
  
  const year = prompt('Enter year:');
  if (!year) return;
  
  const url = prompt('Enter URL (optional, press Enter to skip):') || '#';
  
  try {
    console.log('Adding new publication:', { title, authors, journalConference, year, url });
    
    const result = await apiCall('add_publication', {
      lecturer_id: lecturer.lecturer_id,
      title: title,
      authors: authors,
      journal_conference: journalConference,
      year: year,
      url: url
    });
    
    console.log('Add publication result:', result);
    
    if (result.success) {
      alert('Publication added successfully!');
      await loadPublications();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error adding publication:', error);
    alert('Error adding publication. Check console.');
  }
}

// Delete publication
async function deletePublication(publicationId) {
  if (!confirm('Are you sure you want to delete this publication? This action cannot be undone.')) {
    return;
  }
  
  try {
    console.log('Deleting publication:', publicationId);
    
    const result = await apiCall('delete_publication', {
      lecturer_id: lecturer.lecturer_id,
      publication_id: publicationId
    });
    
    console.log('Delete publication result:', result);
    
    if (result.success) {
      alert('Publication deleted successfully!');
      await loadPublications();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error deleting publication:', error);
    alert('Error deleting publication. Check console.');
  }
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
        
        // Setup search functionality
        setupStudentSearch();
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

// Setup student search
function setupStudentSearch() {
  const searchInput = document.querySelector('#page-students .search-bar');
  if (!searchInput) return;
  
  // Remove old event listeners by cloning
  const newSearchInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newSearchInput, searchInput);
  
  newSearchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#page-students tbody tr');
    
    rows.forEach(row => {
      const matricNo = row.cells[0]?.textContent.toLowerCase() || '';
      const name = row.cells[1]?.textContent.toLowerCase() || '';
      const email = row.cells[2]?.textContent.toLowerCase() || '';
      const course = row.cells[3]?.textContent.toLowerCase() || '';
      
      const matches = matricNo.includes(searchTerm) || 
                     name.includes(searchTerm) || 
                     email.includes(searchTerm) ||
                     course.includes(searchTerm);
      
      if (matches) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });
  
  console.log('Student search setup complete');
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
          html += '<div class="table-responsive"><table class="styled-table"><thead><tr><th>Course</th><th>Assignment</th><th>Due Date</th><th>Submissions</th><th>Pending</th></tr></thead><tbody>';
          
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
          
          html += '</tbody></table></div>';
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
    alert('Error loading assignments: ' + error.message);
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
          grid.innerHTML = `
            <div class="card add-new-card" onclick="addNewCourse()" style="cursor: pointer;">
              <i class="fa-solid fa-plus"></i>
              <p>Create New Course</p>
            </div>
          `;
        } else {
          let html = result.courses.map(c => `
            <div class="card" style="position: relative;">
              <button onclick="deleteCourse(${c.course_id}, '${c.course_code}')" 
                      class="delete-btn" 
                      style="position: absolute; top: 10px; right: 10px; padding: 0.3rem 0.6rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;"
                      title="Delete course">
                <i class="fa-solid fa-trash"></i>
              </button>
              <h4>${c.course_code}: ${c.title}</h4>
              <p>${c.student_count || 0} Students</p>
              <p>Level ${c.level}, ${c.assignment_count || 0} Assignments</p>
            </div>
          `).join('');
          
          html += `
            <div class="card add-new-card" onclick="addNewCourse()" style="cursor: pointer;">
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

// Add new course
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

// Delete course
async function deleteCourse(courseId, courseCode) {
  if (!confirm(`Are you sure you want to delete course ${courseCode}? This will also delete all related assignments and enrollments. This action cannot be undone.`)) {
    return;
  }
  
  try {
    console.log('Deleting course:', courseId);
    
    const result = await apiCall('delete_course', {
      lecturer_id: lecturer.lecturer_id,
      course_id: courseId
    });
    
    console.log('Delete course result:', result);
    
    if (result.success) {
      alert('Course deleted successfully!');
      // Reload courses page
      await loadCourses();
      // Reload dashboard data to update stats
      await loadDashboardData();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    alert('Error deleting course. Check console.');
  }
}

// Setup mobile menu
function setupMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  const sidebarLinks = document.querySelectorAll('.nav-links a');

  if (mobileBtn) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      mobileBtn.classList.toggle('moved');
      
      const icon = mobileBtn.querySelector('i');
      if (sidebar.classList.contains('open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
      } else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
      }
    });
  }

  if (mainContent) {
    mainContent.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (mobileBtn) mobileBtn.classList.remove('moved');
        
        const icon = mobileBtn?.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 992) {
        sidebar.classList.remove('open');
        if (mobileBtn) mobileBtn.classList.remove('moved');
        
        const icon = mobileBtn?.querySelector('i');
        if (icon) {
          icon.classList.remove('fa-xmark');
          icon.classList.add('fa-bars');
        }
      }
    });
  });
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
  
  // Add course button handler
  const addCourseBtn = document.getElementById('addCourse');
  if (addCourseBtn) {
    addCourseBtn.addEventListener('click', function() {
      addNewCourse();
    });
  }
}
