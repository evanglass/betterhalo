let haloUrl = null;
let haloApiUrl = null;
let LMS_AUTH_value = null;
let LMS_CONTEXT_value = null;
let queue = [];
let pendingUpdateTimeout = null;
let settings = {
    upcomingAssignmentCount: 5
};

///
/// UTILITIES
///

function getHaloUrl() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'get_halo_url' }, (response) => {
            resolve(response.haloUrl || 'https://halo.gcu.edu');
        });
    });
}

function getSettings() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'get_settings' }, (response) => {
            resolve(response);
        });
    });
}

function weAreOnHomepage() {
    return window.location.pathname === '/';
}

function getCardFromClassCode(classCode, cards) {
    let card_pres = cards.find(card => card.textContent.includes(classCode));

    return card_pres ? card_pres.parentElement.parentElement.parentElement : null;
}

function applyStyles(element, styles) {
    for (const property in styles) {
        element.style[property] = styles[property];
    }
}

///
/// API INTERACTIONS
///

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

///
/// PAGE UPDATES
///

async function update_homepage(tokens, settings) {
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

    // Cache important dates
    const currentDate = new Date();
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Fetch all grades in parallel
    const gradePromises = classes.map(classInfo => 
        getAllAssessmentGrades(tokens, classInfo.slugId)
            .then(response => ({ classId: classInfo.id, response }))
    );

    // Create a hash map of classId to grades response
    const allGradesResults = await Promise.all(gradePromises);

    const gradesMap = new Map(allGradesResults.map(res => [res.classId, res.response]));

    // Iterate through classes and update homepage cards
    let cardContentsMap = new Map();
    for (const classInfo of classes) {
        let upcoming_assessments_div = document.createElement('div');
        applyStyles(upcoming_assessments_div, {
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #ccc'
        });

        // Add class in outer container for cleanup
        upcoming_assessments_div.classList.add('betterhalo');

        // Copy assessment statuses
        const allGradesResponse = gradesMap.get(classInfo.id);
            
        if (!allGradesResponse || !allGradesResponse.data) {
            console.error('Failed to retrieve grades for', classInfo.slugId, allGradesResponse?.errors);
            continue;
        }

        // Flatten all of the assessment units together since we don't care about units here
        let all_assessments = classInfo.units.flatMap(unit => unit.assessments);
        const assessmentMap = new Map(all_assessments.map(a => [a.id, a]));

        // Update assessment statuses
        for (const assessment of allGradesResponse.data.assessmentGrades[0].grades) {
            const assessmentInfo = assessmentMap.get(assessment.assessment.id);

            if (assessmentInfo) {
                assessmentInfo.status = assessment.status;
            }
        }

        // Filter for upcoming assessments due within two weeks
        let upcoming_assessments = all_assessments
            .filter(
                (assessment) => {
                    const isActive = assessment.status === 'ACTIVE';
                    const isWithinNextTwoWeeks = new Date(assessment.dueDate) <= twoWeeksFromNow;
                    return isActive && isWithinNextTwoWeeks;
                }
            )
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        // Create assessment list elements
        if (upcoming_assessments.length > 0) {
            let list = document.createElement('div');
            applyStyles(list, {
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
            });

            let count = 0;
            for (const assessment of upcoming_assessments) {
                // Create the container for the assessment
                let listItem = document.createElement('div');
                applyStyles(listItem, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #eee',
                    paddingBottom: '5px'
                });
                listItem.setAttribute('data-class-id', classInfo.id);
                
                // Limit upcoming assessments and hide those more than a week past due
                // TODO: Prioritize showing today/tomorrow assessments over past due ones if needed
                const isTooMany = count > settings.upcomingAssignmentCount - 1;
                const isOverAWeekPastDue = new Date(assessment.dueDate) < new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                if (isTooMany || isOverAWeekPastDue) {
                    listItem.style.display = 'none';
                } else {
                    count++;
                }

                // Add the assignment title to the container
                let listItemName = document.createElement('strong');
                applyStyles(listItemName, {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexShrink: '1'
                });

                listItemName.textContent = assessment.title;
                listItem.appendChild(listItemName);

                // Add the due date to the container
                let listItemDue = document.createElement('span');
                applyStyles(listItemDue, {
                    textAlign: 'right',
                    whiteSpace: 'nowrap'
                });

                let dueDate = new Date(assessment.dueDate);

                // PAST DUE: "Past Due <date>" (red)
                // DUE TODAY: "Today <time>" (orange)
                // DUE TOMORROW: "Tomorrow <time>" (normal)
                // DUE THIS WEEK: "<DayOfWeek> <time>" (normal)
                // DUE LATER: "<date>" (normal)
                if (dueDate < currentDate) {
                    listItemDue.textContent = `Past Due ${dueDate.toLocaleDateString()}`;
                    listItemDue.style.color = 'red';
                } else if (dueDate < new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000)) {
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

                // Append the assessment item to the list
                list.appendChild(listItem);
            }

            // Append the list to the assessments div
            upcoming_assessments_div.appendChild(list);

            // Add a "Show More" button which is enabled if there are hidden assessments
            if (count > settings.upcomingAssignmentCount - 1) {
                let showMoreButton = document.createElement('button');

                applyStyles(showMoreButton, {
                    marginTop: '5px',
                    color: '#007bff',
                    textDecoration: 'underline'
                });

                showMoreButton.textContent = 'Show More';

                showMoreButton.addEventListener('click', () => {
                    const hiddenItems = upcoming_assessments_div.querySelectorAll('div[data-class-id=\"' + classInfo.id + '\"][style*="display: none"]');
                    hiddenItems.forEach(item => item.style.display = 'flex');
                    showMoreButton.style.display = 'none';
                });

                upcoming_assessments_div.appendChild(showMoreButton);
            }
        } else {
            // Create a "No upcoming assessments" message if none are found
            let noAssessments = document.createElement('p');
            noAssessments.textContent = 'No upcoming assessments';
            upcoming_assessments_div.appendChild(noAssessments);
        }

        // Add the assessments div to the card
        cardContentsMap.set(classInfo.id, upcoming_assessments_div);
    }

    // Finally, append all created assessment divs to their respective cards
    function appendCards() {
        const cards = Array.from(document.querySelectorAll(`div[role='presentation']`));

        if (cards.length === 0) {
            // Retry after a short delay if cards are not yet loaded
            setTimeout(appendCards, 50);
            return;
        }

        for (const [classId, assessmentsDiv] of cardContentsMap.entries()) {
            const card = getCardFromClassCode(classes.find(c => c.id === classId).classCode, cards);
            if (card) {
                card.appendChild(assessmentsDiv);
            }
        }
    }

    appendCards();
}

function update_page() {
    // Don't try updating without the cookies
    if (!LMS_AUTH_value || !LMS_CONTEXT_value) {
        return;
    }

    // Clear any pending update to avoid multiple concurrent update loops
    if (pendingUpdateTimeout) {
        clearTimeout(pendingUpdateTimeout);
    }

    const tokens = {
        LMS_AUTH: LMS_AUTH_value,
        LMS_CONTEXT: LMS_CONTEXT_value
    };

    if (weAreOnHomepage()) {
        update_homepage(tokens, settings);
    }
}

///
/// MESSAGE HANDLING
///

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

        update_page();
    });
}

///
/// INITIALIZATION
///

async function onload() {
    haloUrl = await getHaloUrl();
    
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
            update_page();
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

            update_page();
            return;
        }

        if (request.action === "settingsUpdated") {
            getSettings().then((newSettings) => {
                settings = newSettings;
                update_page();
            });

            return;
        }
    });
    
    // Initial request for cookies to populate content
    request_cookies();
}

onload();
