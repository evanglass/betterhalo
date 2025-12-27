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

function getCardFromClassCode(classCode, cards) {
    let card_pres = cards.find(card => card.innerHTML.includes(classCode));

    return card_pres ? card_pres.parentElement.parentElement.parentElement : null;
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

    const classes = classListResponse.data.getCourseClassesForUser.courseClasses;

    const cards = Array.from(document.querySelectorAll(`div[role='presentation']`));
    const currentDate = new Date();
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Fetch all grades in parallel
    const gradePromises = classes.map(classInfo => 
        getAllAssessmentGrades(tokens, classInfo.slugId)
            .then(response => ({ classId: classInfo.id, response }))
    );

    const allGradesResults = await Promise.all(gradePromises);
    const gradesMap = new Map(allGradesResults.map(res => [res.classId, res.response]));

    for (const classInfo of classes) {
        let card = getCardFromClassCode(classInfo.classCode, cards);

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
        const allGradesResponse = gradesMap.get(classInfo.id);
            
        if (!allGradesResponse || !allGradesResponse.data) {
            console.error('Failed to retrieve grades for', classInfo.slugId, allGradesResponse?.errors);
            continue;
        }

        let all_assessments = classInfo.units.flatMap(unit => unit.assessments);
        const assessmentMap = new Map(all_assessments.map(a => [a.id, a]));

        for (const unitGrade of allGradesResponse.data.assessmentGrades) {
            for (const grade of unitGrade.grades) {
                const assessmentId = grade.assessment.id;
                const assessment = assessmentMap.get(assessmentId);
                if (assessment) {
                    assessment.status = grade.status;
                }
            }
        }

        let upcoming_assessments = all_assessments
            .filter(
                (assessment) => {
                    const isActive = assessment.status === 'ACTIVE';
                    const isWithinNextTwoWeeks = new Date(assessment.dueDate) <= twoWeeksFromNow;
                    return isActive && isWithinNextTwoWeeks;
                }
            )
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (upcoming_assessments.length > 0) {
            let list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '5px';

            let count = 0;
            for (const assessment of upcoming_assessments) {
                let listItem = document.createElement('div');
                listItem.style.display = 'flex';
                listItem.style.justifyContent = 'space-between';
                listItem.style.borderBottom = '1px solid #eee';
                listItem.style.paddingBottom = '5px';
                listItem.setAttribute('data-class-id', classInfo.id);
                
                const isTooMany = count > 4;
                const isOverAWeekPastDue = new Date(assessment.dueDate) < new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (isTooMany || isOverAWeekPastDue) {
                    listItem.style.display = 'none';
                } else {
                    count++;
                }

                let listItemName = document.createElement('strong');
                listItemName.style.whiteSpace = 'nowrap';
                listItemName.style.overflow = 'hidden';
                listItemName.style.textOverflow = 'ellipsis';
                listItemName.style.flexShrink = '1';
                listItemName.textContent = assessment.title;
                listItem.appendChild(listItemName);

                let listItemDue = document.createElement('span');
                listItemDue.style.textAlign = 'right';
                listItemDue.style.whiteSpace = 'nowrap';

                let dueDate = new Date(assessment.dueDate);

                if (dueDate < currentDate) {
                    listItemDue.textContent = `Past Due ${dueDate.toLocaleDateString()}`;
                    listItemDue.style.color = 'red';
                } else if (dueDate >= new Date(currentDate.getTime()) && dueDate < new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000)) {
                    listItemDue.textContent = `Today ${dueDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                    listItemDue.style.color = 'orange';
                } else if (dueDate >= new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000) && dueDate <= new Date(currentDate.getTime() + 2 * 24 * 60 * 60 * 1000)) {
                    listItemDue.textContent = `Tomorrow ${dueDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                } else if (dueDate <= new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)) {
                    const dayOfWeek = dueDate.toLocaleDateString(undefined, { weekday: 'long' });
                    listItemDue.textContent = `${dayOfWeek} ${dueDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    listItemDue.textContent = `${dueDate.toLocaleDateString()}`;
                }

                listItem.appendChild(listItemDue);
                list.appendChild(listItem);
            }

            let showMoreButton = document.createElement('button');
            showMoreButton.textContent = 'Show More';
            showMoreButton.style.marginTop = '5px';
            showMoreButton.style.color = '#007bff';
            showMoreButton.style.textDecoration = 'underline';
            showMoreButton.addEventListener('click', () => {
                const hiddenItems = upcoming_assessments_div.querySelectorAll('div[data-class-id=\"' + classInfo.id + '\"][style*="display: none"]');
                hiddenItems.forEach(item => item.style.display = 'flex');
                showMoreButton.style.display = 'none';
            });

            upcoming_assessments_div.appendChild(list);
            upcoming_assessments_div.appendChild(showMoreButton);
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

    // Make sure the card elements are loaded
    if (document.querySelectorAll(`div[role='presentation']`).length === 0) {
        enqueueFunction(update_page);
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

        enqueueFunction(update_page);
    });
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

function enqueueFunction(func) {
    if (queue.includes(func)) {
        return;
    }

    if (queue.length === 0) {
        window.setTimeout(processQueue, 10);
    }

    queue.push(func);
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
        if (request.action === "historyStateUpdated") {
            enqueueFunction(update_page);
            return;
        }
        
        if (request.action === "lmsCookiesChanged") {
            if (LMS_AUTH_value && LMS_CONTEXT_value) {
                // If both cookies are already set, don't bother refreshing the page
                return;
            }

            if (request.cookieName === "LMS_AUTH") {
                LMS_AUTH_value = request.cookieValue;
            } else if (request.cookieName === "LMS_CONTEXT") {
                LMS_CONTEXT_value = request.cookieValue;
            }

            enqueueFunction(update_page);
            return;
        }
    });
    
    // Initial request for cookies to populate content
    enqueueFunction(request_cookies);
    enqueueFunction(update_page);
}

onload();
