let haloUrl = null;
let haloApiUrl = null;
let LMS_AUTH_value = null;
let LMS_CONTEXT_value = null;
let queue = [];

function getHaloUrl() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'get_halo_url' }, (response) => {
            resolve(response.haloUrl || null);
        });
    });
}

function weAreOnHomepage() {
    return window.location.pathname === '/';
}

async function getClassList(tokens) {
    const query = 
`query GetCourseClassesForUser($pgNum: Int, $pgSize: Int) {
  getCourseClassesForUser(pgNum: $pgNum, pgSize: $pgSize) {
    courseClasses {
      ...CurrentClass_currentClass
      __typename
    }
    __typename
  }
}

fragment CurrentClass_currentClass on CourseClass {
    id
    classCode
    slugId
    startDate
    endDate
    description
    name
    stage
    modality
    modifiedDate
    credits
    courseCode
    version
    lastPublishedDate
    sectionId
    units {
        ...CurrentClass_currentClass_units
        __typename
    }
    __typename
}

fragment CurrentClass_currentClass_units on CourseClassUnit {
    id
    title
    sequence
    startDate
    endDate
    current
    points
    description
    assessments {
        ...CurrentClass_currentClass_units_assessments
        __typename
    }
    __typename
}

fragment CurrentClass_currentClass_units_assessments on CourseClassAssessment {
    id
    sequence
    title
    description
    startDate
    dueDate
    points
    type
    tags
    requiresLopesWrite
    isGroupEnabled
    inPerson
    __typename
}`;

    const requestBody = {
        "operationName": "GetCourseClassesForUser",
        "variables": {
            "pgNum": 1,
            "pgSize": 50
        },
        "query": query
    };

    const classList = await fetch(haloApiUrl, {
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json",
            "Access-Control-Allow-Credentials": "true",
            "Authorization": "Bearer " + tokens.LMS_AUTH,
            "ContextToken": "Bearer " + tokens.LMS_CONTEXT,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site"
        },
        "referrer": haloUrl + "/",
        "body": JSON.stringify(requestBody),
        "method": "POST",
        "mode": "cors"
    }).then(response => response.json());

    return classList;
}

async function getAllAssessmentGrades(tokens, classSlug, courseUnitId = null) {
    const query =
`query AllAssessmentGrades($courseClassSlugId: String!, $courseUnitId: String) {
  assessmentGrades: getAllClassGrades(
    courseClassSlugId: $courseClassSlugId
    courseUnitId: $courseUnitId
  ) {
    ...AllAssessmentGrades_assessmentGrades
    __typename
  }
}

fragment AllAssessmentGrades_assessmentGrades on UserCourseClassGrade {
  grades {
    ...AllAssessmentGrades_assessmentGrades_grades
    __typename
  }
  __typename
}

fragment AllAssessmentGrades_assessmentGrades_grades on UserCourseClassAssessmentGrade {
  user {
    ...AllAssessmentGrades_assessmentGrades_grades_user
    __typename
  }
  userLastSeenDate
  assessment {
    ...AllAssessmentGrades_assessmentGrades_grades_assessment
    __typename
  }
  accommodatedDueDate
  dueDate
  id
  status
  assignmentSubmission {
    ...AllAssessmentGrades_assessmentGrades_grades_assignmentSubmission
    __typename
  }
  userQuizAssessment {
    ...AllAssessmentGrades_assessmentGrades_grades_userQuizAssessment
    __typename
  }
  isEverReassigned
  history {
    assignmentSubmissionId
    comment
    gradeId
    status
    points
    reassignAttachments {
      modifiedDate
      resource {
        active
        context
        createdBy
        createdDate
        description
        embedReady
        id
        kind
        modifiedBy
        modifiedDate
        name
        type
        url
        __typename
      }
      __typename
    }
    userCourseClassAssessmentId
    __typename
  }
  __typename
}

fragment AllAssessmentGrades_assessmentGrades_grades_user on User {
  id
  __typename
}

fragment AllAssessmentGrades_assessmentGrades_grades_assessment on CourseClassAssessment {
  id
  inPerson
  __typename
}

fragment AllAssessmentGrades_assessmentGrades_grades_assignmentSubmission on AssignmentSubmission {
  submissionDate
  __typename
}

fragment AllAssessmentGrades_assessmentGrades_grades_userQuizAssessment on QuizUserCourseClassAssessment {
  userQuizId
  accommodatedDuration
  __typename
}`;

    const requestBody = {
        "operationName": "AllAssessmentGrades",
        "variables": {
            "courseClassSlugId": classSlug,
            "courseUnitId": null
        },
        "query": query
    };

    const allGrades = await fetch(haloApiUrl, {
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.5",
            "Content-Type": "application/json",
            "Access-Control-Allow-Credentials": "true",
            "Authorization": "Bearer " + tokens.LMS_AUTH,
            "ContextToken": "Bearer " + tokens.LMS_CONTEXT,
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site"
        },
        "referrer": haloUrl + "/",
        "body": JSON.stringify(requestBody),
        "method": "POST",
        "mode": "cors"
    }).then(response => response.json());

    return allGrades;
}

function getCardFromClassCode(classCode) {
    let pres = document.querySelectorAll(`div[role='presentation']`);

    let card_pres = Array.from(pres).find(card => card.innerHTML.includes(classCode));

    return card_pres.parentElement.parentElement.parentElement;
}

async function update_homepage(tokens) {
    console.log('Updating homepage with BetterHalo info');

    // Remove existing BetterHalo elements
    const existing_sections = document.querySelectorAll('.betterhalo');
    existing_sections.forEach(section => section.remove());

    const classListResponse = await getClassList(tokens);

    if (!classListResponse.data) {
        console.error('Failed to retrieve class list');
        return;
    }

    console.log('Retrieved class list:', classListResponse.data.getCourseClassesForUser.courseClasses);

    for (const classInfo of classListResponse.data.getCourseClassesForUser.courseClasses) {
        console.log("Updating class:", classInfo.classCode);

        let card = getCardFromClassCode(classInfo.classCode);

        if (!card) {
            console.error('Failed to find card for', classInfo.classCode);
            continue;
        }

        let upcoming_assessments_div = document.createElement('div');
        upcoming_assessments_div.style.marginTop = '10px';
        upcoming_assessments_div.style.paddingTop = '10px';
        upcoming_assessments_div.style.borderTop = '1px solid #ccc';
        upcoming_assessments_div.classList.add('betterhalo');

        card.appendChild(upcoming_assessments_div);

        // Copy assessment statuses
        const allGradesResponse = await getAllAssessmentGrades(tokens, classInfo.slugId, classInfo.units.forEach(u => u.id));
            
        if (!allGradesResponse.data) {
            console.error('Failed to retrieve grades for', classInfo.slugId, allGradesResponse.errors);
            continue;
        }

        let all_assessments = classInfo.units.flatMap(unit => unit.assessments);

        for (const unitGrade of allGradesResponse.data.assessmentGrades) {
            for (const grade of unitGrade.grades) {
                const assessmentId = grade.assessment.id;
                const assessment = all_assessments.find(a => a.id === assessmentId);
                if (assessment) {
                    assessment.status = grade.status;
                }
            }
        }

        let upcoming_assessments = all_assessments
            .filter(
                (assessment) => {
                    const isActive = assessment.status === 'ACTIVE';
                    const isWithinNextTwoWeeks = new Date(assessment.dueDate) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                    return isActive && isWithinNextTwoWeeks;
                }
            )
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (upcoming_assessments.length > 0) {
            let list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '5px';

            for (const assessment of upcoming_assessments) {
                let listItem = document.createElement('div');
                listItem.style.display = 'flex';
                listItem.style.justifyContent = 'space-between';
                listItem.style.borderBottom = '1px solid #eee';
                listItem.style.paddingBottom = '5px';

                let listItemName = document.createElement('strong');
                listItemName.textContent = assessment.title;
                listItem.appendChild(listItemName);

                let listItemDue = document.createElement('span');
                listItemDue.style.textAlign = 'right';

                let dueDate = new Date(assessment.dueDate);

                if (dueDate < Date.now()) {
                    listItemDue.textContent = `Past Due ${dueDate.toLocaleDateString()}`;
                    listItemDue.style.color = 'red';
                } else if (dueDate.getDate() === (new Date()).getDate()) {
                    listItemDue.textContent = `Today ${dueDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                } else if (dueDate.getDate() === (new Date()).getDate() + 1) {
                    listItemDue.textContent = `Tomorrow ${dueDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                } else if (dueDate.getDate() <= (new Date()).getDate() + 7) {
                    const dayOfWeek = dueDate.toLocaleDateString(undefined, { weekday: 'long' });
                    listItemDue.textContent = `${dayOfWeek} ${dueDate.toLocaleTimeString()}`;
                } else {
                    listItemDue.textContent = `${dueDate.toLocaleDateString()}`;
                }

                listItem.appendChild(listItemDue);
                list.appendChild(listItem);
            }

            upcoming_assessments_div.appendChild(list);
        } else {
            let noAssessments = document.createElement('p');
            noAssessments.textContent = 'No upcoming assessments';
            upcoming_assessments_div.appendChild(noAssessments);
        }
    }
}

function update_page() {
    if (!LMS_AUTH_value || !LMS_CONTEXT_value) {
        return;
    }

    if (document.querySelectorAll(`div[role='presentation']`).length === 0) {
        queue.push(update_page);
        return;
    }

    const tokens = {
        LMS_AUTH: LMS_AUTH_value,
        LMS_CONTEXT: LMS_CONTEXT_value
    };

    if (weAreOnHomepage()) {
        update_homepage(tokens);
    }
}

function request_cookies() {
    // Retrieve LMS cookies
    if (!LMS_AUTH_value || !LMS_CONTEXT_value) {
        chrome.runtime.sendMessage({ action: 'get_lms_cookies' }, (response) => {
            if (response.error) {
                console.error('Error retrieving cookies:', response.error);
                return;
            }

            if (!response.LMS_AUTH || !response.LMS_CONTEXT) {
                return;
            }

            LMS_AUTH_value = response.LMS_AUTH;
            LMS_CONTEXT_value = response.LMS_CONTEXT;
        });
    }
}

function processQueue() {
    if (queue.length > 0) {
        const func = queue.shift();

        // Remove duplicates of the same function in the queue
        queue = queue.filter(f => f !== func);

        func();
        
        window.setTimeout(processQueue, 10);
    }
}

async function onload() {
    haloUrl = await getHaloUrl() || 'https://halo.gcu.edu';
    
    // Append gateway. to halo url
    const haloApiUrlBuilder = new URL(haloUrl);
    haloApiUrlBuilder.hostname = 'gateway.' + haloApiUrlBuilder.hostname;
    haloApiUrl = haloApiUrlBuilder.toString();

    if (!haloUrl || !haloApiUrl) {
        return;
    }

    // Make sure current page URL starts with the Halo URL
    if (!window.location.href.startsWith(haloUrl)) {
        return;
    }

    console.log('BetterHalo content script loaded');

    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (document.querySelector('.betterhalo')) {
            // If BetterHalo elements exist, don't re-request cookies
            return;
        }
        
        if (request.action === "historyStateUpdated") {
            queue.push(update_page);
            window.setTimeout(processQueue, 10);
            return;
        }
        
        if (request.action === "lmsCookiesChanged") {
            if (request.cookieName === "LMS_AUTH") {
                LMS_AUTH_value = request.cookieValue;
            } else if (request.cookieName === "LMS_CONTEXT") {
                LMS_CONTEXT_value = request.cookieValue;
            }

            queue.push(update_page);
            window.setTimeout(processQueue, 10);
            return;
        }
    });
    
    // Initial request for cookies to populate content
    queue.push(request_cookies);
    queue.push(update_page);
    window.setTimeout(processQueue, 10);
}

onload();
