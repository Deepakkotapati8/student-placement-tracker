
const main = document.querySelector(".main");

// ==================== API HELPER ====================

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const text = await response.text();
    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed: ${response.status}`
        );
    }

    return data;
}

// ==================== HTML SAFETY ====================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

// ==================== NAVIGATION ====================

function showPage(page) {
    const pages = {
        dashboard: showDashboard,
        skills: showSkills,
        dsa: showDSA,
        companies: showCompanies,
        interviews: showInterviews,
        projects: showProjects
    };

    if (pages[page]) {
        pages[page]();
    }
}

// ==================== DASHBOARD ====================

async function showDashboard() {
    try {
        const [skills, dsa, projects, companies, interviews] =
            await Promise.all([
                apiRequest("/api/skills"),
                apiRequest("/api/dsa"),
                apiRequest("/api/projects"),
                apiRequest("/api/companies"),
                apiRequest("/api/interviews")
            ]);

        const totalSolved = dsa.reduce(
            (sum, topic) =>
                sum + Number(topic.solved_problems || 0),
            0
        );

        const totalProblems = dsa.reduce(
            (sum, topic) =>
                sum + Number(topic.total_problems || 0),
            0
        );

        const dsaProgress = totalProblems > 0
            ? Math.min(
                100,
                Math.round((totalSolved / totalProblems) * 100)
            )
            : 0;

        const appliedCompanies = companies.filter(company =>
            ["Applied", "Interview", "Selected"].includes(company.status)
        ).length;

        main.innerHTML = `
            <h1>Placement Dashboard</h1>
            <p>Track your preparation and placement journey.</p>

            <div class="cards">
                <div class="card">
                    <h3>📚 Skills</h3>
                    <p>${skills.length}</p>
                </div>

                <div class="card">
                    <h3>💻 DSA Topics</h3>
                    <p>${dsa.length}</p>
                </div>

                <div class="card">
                    <h3>✅ Problems Solved</h3>
                    <p>${totalSolved}</p>
                </div>

                <div class="card">
                    <h3>🚀 Projects</h3>
                    <p>${projects.length}</p>
                </div>

                <div class="card">
                    <h3>🏢 Companies Applied</h3>
                    <p>${appliedCompanies}</p>
                </div>

                <div class="card">
                    <h3>🎤 Interviews</h3>
                    <p>${interviews.length}</p>
                </div>
            </div>

            <div class="card">
                <h2>DSA Progress</h2>

                <div class="progress-container">
                    <div class="progress-bar"
                         style="width: ${dsaProgress}%">
                    </div>
                </div>

                <p>${dsaProgress}% completed</p>
                <p>${totalSolved} solved out of ${totalProblems} total problems</p>
            </div>
        `;
    } catch (error) {
        main.innerHTML = `
            <h1>Placement Dashboard</h1>
            <p>Could not load dashboard: ${escapeHTML(error.message)}</p>
        `;
    }
}

// ==================== REUSABLE DELETE FUNCTION ====================

async function deleteRecord(url, itemName, refreshFunction) {
    const confirmed = confirm(
        `Are you sure you want to delete this ${itemName}?\nThis action cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(url, {
            method: "DELETE"
        });

        alert(`${itemName} deleted successfully!`);

        await refreshFunction();
    } catch (error) {
        alert(
            `Could not delete ${itemName}: ${error.message}\n\n` +
            "Check whether the DELETE route exists in app.py."
        );
    }
}

// ==================== SKILLS ====================

async function showSkills() {
    try {
        const skills = await apiRequest("/api/skills");

        main.innerHTML = `
            <h1>My Skills</h1>
            <p>Track your technical skills and learning progress.</p>

            <button onclick="addSkill()">+ Add Skill</button>

            <br><br>

            <input
                type="text"
                id="skillSearch"
                placeholder="Search skill name..."
                oninput="filterSkills()"
            >

            <select id="skillProgressFilter" onchange="filterSkills()">
                <option value="All">All Progress Levels</option>
                <option value="Beginner">Beginner (0–30%)</option>
                <option value="Intermediate">Intermediate (31–70%)</option>
                <option value="Advanced">Advanced (71–100%)</option>
            </select>

            <div id="skillsList"></div>
        `;

        window.skillsData = skills;
        filterSkills();
    } catch (error) {
        main.innerHTML = `
            <h1>My Skills</h1>
            <p>Could not load skills: ${escapeHTML(error.message)}</p>
        `;
    }
}

function filterSkills() {
    const searchInput = document.getElementById("skillSearch");
    const progressFilter = document.getElementById("skillProgressFilter");
    const skillsList = document.getElementById("skillsList");

    if (!searchInput || !progressFilter || !skillsList) {
        return;
    }

    const search = searchInput.value.toLowerCase().trim();
    const selectedLevel = progressFilter.value;

    const filteredSkills = (window.skillsData || []).filter(skill => {
        const name = (skill.name || "").toLowerCase();
        const progress = Number(skill.progress) || 0;

        let level = "Beginner";

        if (progress > 70) {
            level = "Advanced";
        } else if (progress > 30) {
            level = "Intermediate";
        }

        return (
            name.includes(search) &&
            (selectedLevel === "All" || level === selectedLevel)
        );
    });

    if (filteredSkills.length === 0) {
        skillsList.innerHTML = "<p>No matching skills found.</p>";
        return;
    }

    skillsList.innerHTML = filteredSkills.map(skill => `
        <div class="card">
            <h3>${escapeHTML(skill.name)}</h3>

            <p>Progress: ${Number(skill.progress) || 0}%</p>

            <progress
                value="${Math.min(100, Math.max(0, Number(skill.progress) || 0))}"
                max="100">
            </progress>

            <br><br>

            <button onclick="updateSkill(${skill.id})">
                Update Progress
            </button>

            <button onclick="deleteRecord(
                '/api/skills/${skill.id}',
                'skill',
                showSkills
            )">
                Delete Skill
            </button>
        </div>
    `).join("");
}

async function addSkill() {
    const name = prompt("Enter skill name:");

    if (name === null || !name.trim()) {
        return;
    }

    const progressInput = prompt("Enter progress (0-100):", "0");

    if (progressInput === null) {
        return;
    }

    const progress = Number(progressInput);

    if (
        progressInput.trim() === "" ||
        !Number.isInteger(progress) ||
        progress < 0 ||
        progress > 100
    ) {
        alert("Enter a whole number between 0 and 100.");
        return;
    }

    try {
        await apiRequest("/api/skills", {
            method: "POST",
            body: JSON.stringify({
                name: name.trim(),
                progress: progress
            })
        });

        alert("Skill added successfully!");
        await showSkills();
    } catch (error) {
        alert("Could not add skill: " + error.message);
    }
}

async function updateSkill(id) {
    const progressInput = prompt("Enter new progress (0-100):");

    if (progressInput === null) {
        return;
    }

    const progress = Number(progressInput);

    if (
        progressInput.trim() === "" ||
        !Number.isInteger(progress) ||
        progress < 0 ||
        progress > 100
    ) {
        alert("Enter a whole number between 0 and 100.");
        return;
    }

    try {
        await apiRequest(`/api/skills/${id}`, {
            method: "PUT",
            body: JSON.stringify({ progress })
        });

        alert("Skill progress updated successfully!");
        await showSkills();
    } catch (error) {
        alert("Could not update skill: " + error.message);
    }
}

// ==================== DSA ====================

async function showDSA() {
    try {
        const topics = await apiRequest("/api/dsa");

        main.innerHTML = `
            <h1>DSA Tracker</h1>
            <p>Track your Data Structures and Algorithms practice.</p>

            <button onclick="addDSA()">+ Add DSA Topic</button>

            <br><br>

            <input
                type="text"
                id="dsaSearch"
                placeholder="Search DSA topic..."
                oninput="filterDSA()"
            >

            <select id="dsaStatusFilter" onchange="filterDSA()">
                <option value="All">All Topics</option>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
            </select>

            <div id="dsaList"></div>
        `;

        window.dsaData = topics;
        filterDSA();
    } catch (error) {
        main.innerHTML = `
            <h1>DSA Tracker</h1>
            <p>Could not load DSA topics: ${escapeHTML(error.message)}</p>
        `;
    }
}

function filterDSA() {
    const searchInput = document.getElementById("dsaSearch");
    const statusFilter = document.getElementById("dsaStatusFilter");
    const dsaList = document.getElementById("dsaList");

    if (!searchInput || !statusFilter || !dsaList) {
        return;
    }

    const search = searchInput.value.toLowerCase().trim();
    const selectedStatus = statusFilter.value;

    const filteredTopics = (window.dsaData || []).filter(topic => {
        const name = (topic.topic || "").toLowerCase();
        const total = Number(topic.total_problems) || 0;
        const solved = Number(topic.solved_problems) || 0;

        let status = "Not Started";

        if (total > 0 && solved >= total) {
            status = "Completed";
        } else if (solved > 0) {
            status = "In Progress";
        }

        return (
            name.includes(search) &&
            (selectedStatus === "All" || status === selectedStatus)
        );
    });

    if (filteredTopics.length === 0) {
        dsaList.innerHTML = "<p>No matching DSA topics found.</p>";
        return;
    }

    dsaList.innerHTML = filteredTopics.map(topic => {
        const total = Number(topic.total_problems) || 0;
        const solved = Number(topic.solved_problems) || 0;

        const percentage = total > 0
            ? Math.min(100, Math.round((solved / total) * 100))
            : 0;

        return `
            <div class="card">
                <h3>${escapeHTML(topic.topic)}</h3>

                <p>Solved: ${solved} / ${total}</p>
                <p>Progress: ${percentage}%</p>

                <progress value="${percentage}" max="100"></progress>

                <br><br>

                <button onclick="updateDSA(${topic.id})">
                    Update Progress
                </button>

                <button onclick="deleteRecord(
                    '/api/dsa/${topic.id}',
                    'DSA topic',
                    showDSA
                )">
                    Delete Topic
                </button>
            </div>
        `;
    }).join("");
}

async function addDSA() {
    const topic = prompt("Enter DSA topic, e.g. Arrays:");

    if (topic === null || !topic.trim()) {
        return;
    }

    try {
        await apiRequest("/api/dsa", {
            method: "POST",
            body: JSON.stringify({
                topic: topic.trim(),
                total_problems: 0,
                solved_problems: 0
            })
        });

        alert("DSA topic added successfully!");
        await showDSA();
    } catch (error) {
        alert("Could not add DSA topic: " + error.message);
    }
}

async function updateDSA(id) {
    const totalInput = prompt("How many problems have you attempted?");

    if (totalInput === null || totalInput.trim() === "") {
        return;
    }

    const total = Number(totalInput);

    if (!Number.isInteger(total) || total < 0) {
        alert("Enter a valid whole number for total problems.");
        return;
    }

    const solvedInput = prompt("How many problems have you solved?");

    if (solvedInput === null || solvedInput.trim() === "") {
        return;
    }

    const solved = Number(solvedInput);

    if (
        !Number.isInteger(solved) ||
        solved < 0 ||
        solved > total
    ) {
        alert("Solved problems must be between 0 and total problems.");
        return;
    }

    try {
        await apiRequest(`/api/dsa/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                total_problems: total,
                solved_problems: solved
            })
        });

        alert("DSA progress updated successfully!");
        await showDSA();
    } catch (error) {
        alert("Could not update DSA progress: " + error.message);
    }
}

// ==================== COMPANIES ====================

async function showCompanies() {
    try {
        const companies = await apiRequest("/api/companies");

        main.innerHTML = `
            <h1>Companies</h1>
            <p>Track your job applications here.</p>

            <button onclick="addCompany()">+ Add Company</button>

            <br><br>

            <input
                type="text"
                id="companySearch"
                placeholder="Search company name..."
                oninput="filterCompanies()"
            >

            <select id="companyStatusFilter" onchange="filterCompanies()">
                <option value="All">All Statuses</option>
                <option value="Not Applied">Not Applied</option>
                <option value="Applied">Applied</option>
                <option value="Interview">Interview</option>
                <option value="Selected">Selected</option>
            </select>

            <div id="companyList"></div>
        `;

        window.companyData = companies;
        filterCompanies();
    } catch (error) {
        main.innerHTML = `
            <h1>Companies</h1>
            <p>Could not load companies: ${escapeHTML(error.message)}</p>
        `;
    }
}

function filterCompanies() {
    const searchInput = document.getElementById("companySearch");
    const statusFilter = document.getElementById("companyStatusFilter");
    const companyList = document.getElementById("companyList");

    if (!searchInput || !statusFilter || !companyList) {
        return;
    }

    const search = searchInput.value.toLowerCase().trim();
    const selectedStatus = statusFilter.value;

    const filteredCompanies = (window.companyData || []).filter(company => {
        const name = (company.name || "").toLowerCase();

        return (
            name.includes(search) &&
            (selectedStatus === "All" || company.status === selectedStatus)
        );
    });

    if (filteredCompanies.length === 0) {
        companyList.innerHTML = "<p>No matching companies found.</p>";
        return;
    }

    companyList.innerHTML = filteredCompanies.map(company => `
        <div class="card">
            <h3>${escapeHTML(company.name)}</h3>
            <p>Status: ${escapeHTML(company.status)}</p>

            <button onclick="updateCompany(${company.id})">
                Update Status
            </button>

            <button onclick="deleteRecord(
                '/api/companies/${company.id}',
                'company',
                showCompanies
            )">
                Delete Company
            </button>
        </div>
    `).join("");
}

async function addCompany() {
    const name = prompt("Enter company name:");

    if (name === null || !name.trim()) {
        return;
    }

    const statusInput = prompt(
        "Choose status:\n1. Not Applied\n2. Applied\n3. Interview\n4. Selected",
        "1"
    );

    if (statusInput === null) {
        return;
    }

    const statuses = {
        "1": "Not Applied",
        "2": "Applied",
        "3": "Interview",
        "4": "Selected"
    };

    const status = statuses[statusInput.trim()];

    if (!status) {
        alert("Enter 1, 2, 3, or 4.");
        return;
    }

    try {
        await apiRequest("/api/companies", {
            method: "POST",
            body: JSON.stringify({
                name: name.trim(),
                status
            })
        });

        alert("Company added successfully!");
        await showCompanies();
    } catch (error) {
        alert("Could not add company: " + error.message);
    }
}

async function updateCompany(id) {
    const choice = prompt(
        "Choose new status:\n" +
        "1. Not Applied\n" +
        "2. Applied\n" +
        "3. Interview\n" +
        "4. Selected",
        "1"
    );

    if (choice === null) {
        return;
    }

    const statuses = {
        "1": "Not Applied",
        "2": "Applied",
        "3": "Interview",
        "4": "Selected"
    };

    const status = statuses[choice.trim()];

    if (!status) {
        alert("Enter 1, 2, 3, or 4.");
        return;
    }

    try {
        await apiRequest(`/api/companies/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status })
        });

        alert("Company status updated successfully!");
        await showCompanies();
    } catch (error) {
        alert("Could not update company: " + error.message);
    }
}

// ==================== PROJECTS ====================

async function showProjects() {
    try {
        const projects = await apiRequest("/api/projects");

        main.innerHTML = `
            <h1>My Projects</h1>
            <p>Manage your programming and portfolio projects.</p>

            <button onclick="addProject()">+ Add Project</button>

            <br><br>

            <input
                type="text"
                id="projectSearch"
                placeholder="Search project name..."
                oninput="filterProjects()"
            >

            <input
                type="text"
                id="projectDescriptionFilter"
                placeholder="Filter by description keyword..."
                oninput="filterProjects()"
            >

            <div id="projectsList"></div>
        `;

        window.projectsData = projects;
        filterProjects();
    } catch (error) {
        main.innerHTML = `
            <h1>My Projects</h1>
            <p>Could not load projects: ${escapeHTML(error.message)}</p>
        `;
    }
}

function filterProjects() {
    const searchInput = document.getElementById("projectSearch");
    const descriptionInput =
        document.getElementById("projectDescriptionFilter");
    const projectsList = document.getElementById("projectsList");

    if (!searchInput || !descriptionInput || !projectsList) {
        return;
    }

    const search = searchInput.value.toLowerCase().trim();
    const descriptionKeyword =
        descriptionInput.value.toLowerCase().trim();

    const filteredProjects = (window.projectsData || []).filter(project => {
        const name = (project.name || "").toLowerCase();
        const description = (project.description || "").toLowerCase();

        return (
            name.includes(search) &&
            description.includes(descriptionKeyword)
        );
    });

    if (filteredProjects.length === 0) {
        projectsList.innerHTML = "<p>No matching projects found.</p>";
        return;
    }

    projectsList.innerHTML = filteredProjects.map(project => `
        <div class="card">
            <h3>${escapeHTML(project.name)}</h3>

            <p>${escapeHTML(
                project.description || "No description added."
            )}</p>

            <button onclick="editProject(${project.id})">
                Edit Project
            </button>

            <button onclick="deleteRecord(
                '/api/projects/${project.id}',
                'project',
                showProjects
            )">
                Delete Project
            </button>
        </div>
    `).join("");
}

async function addProject() {
    const name = prompt("Enter project name:");

    if (name === null || !name.trim()) {
        return;
    }

    const description = prompt("Enter project description:");

    if (description === null) {
        return;
    }

    try {
        await apiRequest("/api/projects", {
            method: "POST",
            body: JSON.stringify({
                name: name.trim(),
                description: description.trim()
            })
        });

        alert("Project added successfully!");
        await showProjects();
    } catch (error) {
        alert("Could not add project: " + error.message);
    }
}

async function editProject(id) {
    try {
        const projects = await apiRequest("/api/projects");

        const project = projects.find(
            item => Number(item.id) === Number(id)
        );

        if (!project) {
            alert("Project not found.");
            return;
        }

        const name = prompt("Enter project name:", project.name);

        if (name === null) {
            return;
        }

        if (!name.trim()) {
            alert("Project name cannot be empty.");
            return;
        }

        const description = prompt(
            "Enter project description:",
            project.description || ""
        );

        if (description === null) {
            return;
        }

        await apiRequest(`/api/projects/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                name: name.trim(),
                description: description.trim()
            })
        });

        alert("Project updated successfully!");
        await showProjects();
    } catch (error) {
        alert("Could not update project: " + error.message);
    }
}

// ==================== INTERVIEWS ====================

async function showInterviews() {
    try {
        const interviews = await apiRequest("/api/interviews");

        main.innerHTML = `
            <h1>Interview Tracker</h1>
            <p>Manage and track your job interviews.</p>

            <button onclick="addInterview()">+ Add Interview</button>

            <br><br>

            <input
                type="text"
                id="interviewSearch"
                placeholder="Search company or job role..."
                oninput="filterInterviews()"
            >

            <select id="interviewStatusFilter"
                    onchange="filterInterviews()">
                <option value="All">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
            </select>

            <div id="interviewsList"></div>
        `;

        window.interviewsData = interviews;
        filterInterviews();
    } catch (error) {
        main.innerHTML = `
            <h1>Interview Tracker</h1>
            <p>Could not load interviews: ${escapeHTML(error.message)}</p>
        `;
    }
}

function filterInterviews() {
    const searchInput = document.getElementById("interviewSearch");
    const statusFilter = document.getElementById("interviewStatusFilter");
    const interviewsList = document.getElementById("interviewsList");

    if (!searchInput || !statusFilter || !interviewsList) {
        return;
    }

    const search = searchInput.value.toLowerCase().trim();
    const selectedStatus = statusFilter.value;

    const filteredInterviews = (window.interviewsData || []).filter(interview => {
        const company = (interview.company || "").toLowerCase();
        const role = (interview.role || "").toLowerCase();
        const status = (interview.status || "").toLowerCase();

        const matchesSearch =
            company.includes(search) || role.includes(search);

        const matchesStatus =
            selectedStatus === "All" ||
            status === selectedStatus.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    if (filteredInterviews.length === 0) {
        interviewsList.innerHTML = "<p>No matching interviews found.</p>";
        return;
    }

    interviewsList.innerHTML = filteredInterviews.map(interview => `
        <div class="card">
            <h3>${escapeHTML(interview.company)}</h3>

            <p><strong>Role:</strong> ${escapeHTML(interview.role)}</p>

            <p><strong>Date:</strong> ${escapeHTML(
                interview.interview_date || "Not specified"
            )}</p>

            <p><strong>Status:</strong> ${escapeHTML(interview.status)}</p>

            <p><strong>Notes:</strong> ${escapeHTML(
                interview.notes || "No notes added."
            )}</p>

            <button onclick="updateInterview(${interview.id})">
                Update Status
            </button>

            <button onclick="deleteRecord(
                '/api/interviews/${interview.id}',
                'interview',
                showInterviews
            )">
                Delete Interview
            </button>
        </div>
    `).join("");
}

async function addInterview() {
    const company = prompt("Enter company name:");

    if (company === null || !company.trim()) {
        return;
    }

    const role = prompt("Enter job role:");

    if (role === null || !role.trim()) {
        return;
    }

    const interviewDate = prompt(
        "Enter interview date (YYYY-MM-DD):"
    );

    if (interviewDate === null) {
        return;
    }

    const status = prompt(
        "Enter status: Scheduled, Completed, or Cancelled",
        "Scheduled"
    );

    if (status === null) {
        return;
    }

    const newStatus = status.trim();

    if (!["Scheduled", "Completed", "Cancelled"].includes(newStatus)) {
        alert("Please enter Scheduled, Completed, or Cancelled.");
        return;
    }

    const notes = prompt("Enter interview notes (optional):");

    if (notes === null) {
        return;
    }

    try {
        await apiRequest("/api/interviews", {
            method: "POST",
            body: JSON.stringify({
                company: company.trim(),
                role: role.trim(),
                interview_date: interviewDate.trim(),
                status: newStatus,
                notes: notes.trim()
            })
        });

        alert("Interview added successfully!");
        await showInterviews();
    } catch (error) {
        alert("Could not add interview: " + error.message);
    }
}

async function updateInterview(id) {
    const status = prompt(
        "Enter new status: Scheduled, Completed, or Cancelled"
    );

    if (status === null) {
        return;
    }

    const newStatus = status.trim();

    if (!["Scheduled", "Completed", "Cancelled"].includes(newStatus)) {
        alert("Please enter Scheduled, Completed, or Cancelled.");
        return;
    }

    try {
        await apiRequest(`/api/interviews/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status: newStatus })
        });

        alert("Interview status updated successfully!");
        await showInterviews();
    } catch (error) {
        alert("Could not update interview: " + error.message);
    }
}

// ==================== SIDEBAR NAVIGATION ====================

document.querySelectorAll(".sidebar a").forEach(link => {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        showPage(this.dataset.page);
    });
});

// ==================== DEFAULT PAGE ====================

showDashboard();

