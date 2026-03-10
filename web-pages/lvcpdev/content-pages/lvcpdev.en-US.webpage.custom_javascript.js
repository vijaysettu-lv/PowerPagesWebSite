<!-- Last modified Fri Oct 31 8:45AM -->
<!-- Last modified Fri Oct 31 8:04AM -->
// Last modified sat aug 16 6:38pm
// Last modified sat aug 16 6:20pm
// Last modified wed jul 16 9:18pm
// Last modified wed jul 16 8:59pm
// Last modified wed jul 16 2:46pm
// Last modified wed jul 16 1:48pm
// Last modified fri jul 11 10:42am
const ROBERTID = "EDA25D58-1CA8-EF11-B8E8-6045BDD4B776"; // an edit in vscode on web - these need to all be removed
const JENNAID = "47bf5a15-5380-ef11-ac21-6045bda6e4f2";
const RICHARDID = "b108c67a-7aa0-ef11-8a69-6045bdd4b776";

let G_APIJSON = {};

// Debug: Ensure functions are globally accessible
console.log('lvcpdev JavaScript loaded at:', new Date().toISOString());

function testToConsole() {
	spinShow();
}

// #region Actions (testApi, deleteRows, ...)

async function testApi(apiUrl, method) {
	$('#lblResults').html('Calling API... <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>');


	const headersText = document.getElementById('headersArea').value;

	const headers = parseHeaders(method, headersText);
	const postData = document.getElementById('postDataArea').value;
	const showFullInfo = isChecked('chkFullRequestInfo');

	const timestamp = new Date().toISOString();

	let requestInfo = `API Call at ${timestamp}\n`;

	const options = { // Prepare fetch options
		method: method,
		headers: headers
	};

	if (method != 'GET' && postData.trim()) { // Add body for non-GET requests
		options.body = postData;
		
		// Set Content-Type header for PATCH/POST/PUT if not already set
		if (['PATCH', 'POST', 'PUT'].includes(method) && !options.headers['Content-Type']) {
			options.headers['Content-Type'] = 'application/json';
		}
	}

	if (apiUrl.includes('businesscentral.dynamics.com')) { // Handle Business Central APIs with MSAL authentication
		try {
			const token = await getToken();

			if (token) {
				options.headers['Authorization'] = `Bearer ${token}`;
				
				if (showFullInfo) {
					requestInfo += `Authentication: Using MSAL (token first 10 chars: ${token.substring(0, 10)}...)\n`;
				}
			}
			options.headers['OData-MaxVersion'] = '4.0';
			options.headers['OData-Version'] = '4.0';
			
			// Modify If-None-Match header for PATCH requests
			if (method === 'PATCH') {
				// Remove If-None-Match for PATCH requests as it's not typically needed
				// PATCH is intended for partial updates where If-None-Match makes less sense
				delete options.headers['If-None-Match'];
			} else {
				options.headers['If-None-Match'] = '*';
			}
			
			// Add return=representation to Prefer header for PATCH requests
			if (method === 'PATCH') {
				options.headers['Prefer'] = 'return=representation,odata.include-annotations="*"';
			} else {
				options.headers['Prefer'] = 'odata.include-annotations="*"';
			}
		} catch (authError) {
			say(`Authentication Error: ${authError.message}`);
			$('#lblResults').html('Results:');
			return;
		}
	}

	if (showFullInfo) {
		requestInfo += `URL: ${apiUrl}\n`;
		requestInfo += `Method: ${method}\n`;
		requestInfo += `Headers:\n${JSON.stringify(options.headers, null, 2)}\n`;

		if (method !== 'GET' && postData.trim()) {
			requestInfo += `Body:\n${postData}\n`;
		}
	}

	// Log to console
	console.log({
		url: apiUrl,
		method: method,
		headers: options.headers,
		body: method === 'GET' ? undefined : postData
	});

	// Display request information
	say(requestInfo + '\n');

	if (showFullInfo)
		say('----- awaiting.... Response: -----\n');

	try {
		const response = await fetch(apiUrl, options); // <------------ ACTUAL WORK
		
		const text = await response.text();

		// If response was successful, save this URL in history
		if (response.ok) {
			// For non-GET methods, pass the actual postData. For GET, leave it null
			const bodyData = method !== 'GET' && postData.trim() ? postData : null;
			saveUrlSuccess(apiUrl, method, bodyData);
			loadSuccessHistory();
		}

		const responseInfo = `Status: ${response.status} ${response.statusText}\n`;

		let finalResponse;
		try {
			G_APIJSON = JSON.parse(text);

			let finalJson;

			if (isChecked('chkLVOnly')) {

				if (Array.isArray(G_APIJSON.value)) {
					// For each object in the array, keep only properties with "lv_" in their names
					G_APIJSON.value = G_APIJSON.value.map(item => {
						return Object.fromEntries(
							Object.entries(item).filter(([key]) => key.includes("lv_"))
						);
					});
				} else {
					console.error("GAPIJSON.value is not an array or doesn't exist");
				}
				finalJson = G_APIJSON;
			} else {
				finalJson = G_APIJSON;
			}

			//finalResponse = "Count: " + G_APIJSON["@odata.count"];
			const sjson = JSON.stringify(finalJson, null, 2); // null='replacer'; 2=indent with 2 spaces
			finalResponse = "jsonlen=" + sjson.length + "\r\n" + responseInfo + sjson;
		} catch (e) {
			// If not JSON, return as text
			finalResponse = responseInfo + text;
		}

		say(finalResponse);
	} catch (error) {
		say(`Error: ${error.message}`);
	} finally {
		$('#lblResults').html('Results:');
	}
}

async function callSelectedFunction() {
	clearResults();

	const apiUrl = document.getElementById('apiUrl').value;

	const method = document.getElementById('apiMethod').value;
	const funcName = document.getElementById('jsFuncName').value;
	const tableNamePlural = getTableNamePlural(apiUrl);
	const p1Val = $('#txtP1').val();
	const colNameRegex = $('#txtColRegex').val();
	const filterExpr = p1Val;


	const idtSpaces = 3;

	if (funcName.Is("testApi")) {
		await testApi(apiUrl, method);
	} else if (funcName.Is("addWebRoleToContact")) {
		const toks = apiUrl.split(",");
		await addWebRoleToContact(toks[0], toks[1]);
	} else if (funcName.Is("apiCall")) {
		const postDataString = document.getElementById('postDataArea').value;
		const fullResponse = await apiCall(apiUrl, method, postDataString);

		// ALWAYS display the full response for debugging
		say("=== FULL API RESPONSE ===");
		say(`SUCCESS: ${fullResponse?.success || 'undefined'}`);
		say(`STATUS: ${fullResponse?.status || 'undefined'} ${fullResponse?.statusText || ''}`);
		say(`MESSAGE: ${fullResponse?.message || 'undefined'}`);

		// Calculate row count (used at top and bottom)
		let rowCount = 0;
		if (fullResponse?.data && fullResponse.success && fullResponse.data.value && Array.isArray(fullResponse.data.value)) {
			rowCount = fullResponse.data.value.length;
		}

		if (fullResponse?.data) {
			say("=== RESPONSE DATA ===");

			// Display row count at top
			if (rowCount > 0) {
				say(`ROW COUNT: ${rowCount} ${rowCount === 1 ? 'record' : 'records'}`);
			}

			if (fullResponse.success && fullResponse.data.value) {
				// Success case with data.value array
				const fullRecord = fullResponse.data.value[0];
				const finalRecord = ExtractProperties(fullRecord, colNameRegex);
				say("EXTRACTED RECORD:");
				say(JSON.stringify(finalRecord, null, idtSpaces));
				say("FULL DATA.VALUE:");
				say(JSON.stringify(fullResponse.data.value, null, idtSpaces));
			} else {
				// Error case or different data structure
				say("FULL DATA:");
				say(JSON.stringify(fullResponse.data, null, idtSpaces));
			}
		} else {
			say("NO DATA IN RESPONSE");
		}

		if (fullResponse?.requestInfo) {
			say("=== REQUEST INFO ===");
			say(fullResponse.requestInfo);
		}

		// Display row count at bottom
		if (rowCount > 0) {
			say("\n=== SUMMARY ===");
			say(`ROW COUNT: ${rowCount} ${rowCount === 1 ? 'record' : 'records'}`);
		}
	} else if (funcName.Is("apiGetRecord")) {
		const oRec = await apiGetRecord(tableNamePlural, filterExpr);
		const finalRec = ExtractProperties(oRec, colNameRegex);
		say(JSON.stringify(finalRec, null, idtSpaces));
	} else if (funcName.Is("apiGetRecords")) {
		const arrRecs = await apiGetRecords(tableNamePlural, filterExpr);
		const arrFinal = ExtractPropertiesFromArray(arrRecs, colNameRegex);
		say(JSON.stringify(arrFinal, null, idtSpaces));
	} else if (funcName.Is("apiGetColumnStringArray")) {
		const colName = colNameRegex;
		const arrColVals = await apiGetColumnStringArray(tableNamePlural, colName, filterExpr);
		say(JSON.stringify(arrColVals, null, idtSpaces));
	} else if (funcName.Is("apiGetColumnStringScalar")) {
		const colName = colNameRegex;
		const strVal = await apiGetColumnStringScalar(tableNamePlural, colName, filterExpr);
		say("strVal=" + strVal);
	} else if (funcName.Begins === "safeAjax") {
		portalApiSafeAjax(apiUrl, method);
	} else if (funcName === "DeleteAllApprovals") {
		const periodNumber = $('#txtP1').val().trim();
		if (!periodNumber || isNaN(periodNumber)) {
			say("DeleteAllApprovals: P1 must contain a valid period number (integer)");
			return;
		}
		say(`DeleteAllApprovals: Deleting all approvals for period ${periodNumber}`);
		await deleteRows("lv_lvcompcommissionapproval", "lv_periodno", periodNumber);
	} else if (funcName === "DeleteLogs") {
		await deleteLogs(apiUrl);
	} else if (funcName === "DeleteRows") {
		const csv = apiUrl;
		let toks = csv.split(',');

		if (toks.length !== 3)
			throw new Error('function DeleteRows: apiUrl must be 3 tokens: logicalname,searchcol,searchval');

		toks = toks.map(token => token.trim());

		await deleteRows(toks[0], toks[1], toks[2]);
	} else if (funcName === "SetYesAllRoles") {
		setWebRoles("Admin,Region,Branch,LO,Assign");
	} else if (funcName === "SetLOAndAssign") {
		setWebRoles("LO,Assign");
	} else if (funcName === "SetWebRoles") {
		setWebRoles();
	} else if (funcName === "UpdateAllContactRoles") {
		await updateAllContactRoles(false); // Production mode
	} else if (funcName === "TestUpdateContactRoles") {
		await updateAllContactRoles(true); // Test mode
	} else if (funcName === "LocalStorageRead") {
		// Read and display specific key (from P1) or all keys if P1 is empty
		const specificKey = $('#txtP1').val().trim();
		const results = [];
		
		try {
			if (specificKey) {
				// Read specific key only
				const value = localStorage.getItem(specificKey);
				if (value !== null) {
					say(`Local Storage key "${specificKey}":\n${value}`);
				} else {
					say(`Local Storage key "${specificKey}" not found`);
				}
			} else {
				// Read all keys (original behavior)
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					const value = localStorage.getItem(key);
					results.push(`${key}: ${value}`);
				}
				if (results.length === 0) {
					say("Local Storage is empty");
				} else {
					say("Local Storage contents:\n" + results.join('\n'));
				}
			}
		} catch (e) {
			say("Error reading local storage: " + e.message);
		}
	} else if (funcName === "LocalStorageSet") {
		// Set local storage key (P1) to value (ColRx)
		const key = $('#txtP1').val().trim();
		const value = $('#txtColRegex').val().trim();
		if (!key) {
			say("LocalStorageSet: P1 must contain the key name");
			return;
		}
		try {
			localStorage.setItem(key, value);
			say(`Local Storage: Set "${key}" = "${value}"`);
		} catch (e) {
			say("Error setting local storage: " + e.message);
		}
	} else if (funcName === "LocalStorageDelete") {
		// Delete local storage key specified in P1
		const key = $('#txtP1').val().trim();
		if (!key) {
			say("LocalStorageDelete: P1 must contain the key name");
			return;
		}
		try {
			const existed = localStorage.getItem(key) !== null;
			localStorage.removeItem(key);
			if (existed) {
				say(`Local Storage: Deleted "${key}"`);
			} else {
				say(`Local Storage: Key "${key}" did not exist`);
			}
		} catch (e) {
			say("Error deleting from local storage: " + e.message);
		}
	}
	else {
		alert('Function not found: ' + funcName);
	}
}

async function setWebRoles(valToSet = "") {
	const contactId = $('#cboId').val();

	if (contactId.IsEmpty()) {
		say("setWebRoles: no contact selected");
		return;
	}

	let newRoles = valToSet;
	if (newRoles.IsEmpty())
		newRoles = $('#apiUrl').val();

	if ( newRoles.Has("http") || newRoles.Has("/") || newRoles.Has("_api") ) {
		say("setWebRoles: Found one of: http, /, or _api in value, no can do");
		return;
	}

	console.error("TODO not implemented 2506011541");
}

async function addWebRoleToContact_FromGemini(contactId, webRoleId) { // This is what Gemini syas. Does not work. Function to add a Web Role to a Contact
    
	if (!contactId || !webRoleId) {
		const msg = "Both Contact ID and Web Role ID are required";
        console.error(msg);
		say(msg);
        return;
    }

    var associationData = {
        // This is the OData ID of the Web Role record being associated
        "@odata.id": "/mspp_webroles(" + webRoleId + ")"
    };

	const url = "/_api/contacts(" + contactId + ")/powerpagecomponent_mspp_webrole_contact/$ref";

	const bogus = await apiCall(url, "POST", associationData);

	say(JSON.stringify(bogus));
}

async function addWebRoleToContact(contactId, webRoleId) { // This is from Copilot. Function to add a Web Role to a Contact
    
	if (!contactId || !webRoleId) {
		const msg = "Both Contact ID and Web Role ID are required";
        console.error(msg);
		say(msg);
        return;
    }

    var associationData = {
        "contact@odata.bind": "/contacts(" + contactId + ")",
		"mspp_webrole@odata.bind": "/mspp_webroles(" + webRoleId + ")"
    };

	const url = "/_api/powerpagecomponent_mspp_webrole_contacts";

	const bogus = await apiCall(url, "POST", associationData);

	say(JSON.stringify(bogus));
}

// #region Delete
async function deleteAllApprovals() { // not yet implemented 
}

async function deleteLogs(kindContains) {
	await deleteRows("lv_lvcomplogs", "lv_kind", kindContains);
}

async function deleteRows(logicalName, searchCol, searchText) {
	try {
		// Step 1: Get all records matching the condition
		let url = `/_api/${logicalName}s/?$filter=contains(${searchCol}, '${searchText}')`;
		if (searchText == '*') {
			url = `/_api/${logicalName}s`;
		} else if (searchText == '!') {
			url = `/_api/${logicalName}s/?$filter=${searchCol} eq null`;
		} else if (!isNaN(searchText) && Number.isInteger(Number(searchText))) {
			// For numeric values, use exact equality instead of contains
			url = `/_api/${logicalName}s/?$filter=${searchCol} eq ${searchText}`;
		}
		
		say(url);

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json"
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to retrieve records: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const records = data.value;

		if (!records || records.length === 0) {
			say("No matching records found to delete");
			return;
		}

		say(`Found ${records.length} records to delete`);

		// Step 2: Delete each record
		let delCnt = 0;
		for (const record of records) {
			// Extract the record ID (assuming lv_logid is the primary key)
			const keyName = `${logicalName}id`
			const recordId = record[keyName];

			// Make the delete request
			const deleteResponse = await fetch(`/_api/${logicalName}s(${recordId})`, {
				method: "DELETE",
				headers: {
				"Accept": "application/json",
				"__RequestVerificationToken": CSRF_TOKEN // Make sure you have this defined
				}
			});

			if (deleteResponse.ok) {
				say(`Successfully deleted record ${recordId}`);
				delCnt++;
			} else {
				say(`Failed to delete record ${recordId}: ${deleteResponse.status} ${deleteResponse.statusText}`);
			}
		}

		say("Deletion process completed: Deleted: " + delCnt);
	} catch (error) {
	  say("Error during deletion process:", error);
	}
}
// #endregion Delete

// #endregion Actions testApi, RobertShow, etc.

// #region LogQuery
function getLogQueryUrl() { // reads controls, assembles, and returns string
	const from = $('#txtLogFrom').val();
	const thru = $('#txtLogThru').val();
	const unam = $('#txtLogUserName').val() || '';
	const kind = $('#txtLogKind').val() || '';
	const detl = $('#txtLogDetail').val() || '';
	const orderBy = $('#ddlOrderBy').val() || 'createdon desc';

	// Base URL with select clause for all needed fields
	let url = "/_api/lv_logs?$select=createdon,lv_userfullname,lv_kind,lv_detail,lv_key1name,lv_key1value,lv_key2name,lv_key2value,lv_memo";

	// Build filter conditions
	let filterConditions = [];
	
	// From date filter (required) - convert local time to UTC
	if (from) {
		const fromUTC = convertLocalTimeToUTC(from);
		if (fromUTC) {
			filterConditions.push(`createdon gt ${fromUTC}`);
		}
	}
	
	// Thru date filter (optional) - convert local time to UTC
	if (thru) {
		const thruUTC = convertLocalTimeToUTC(thru);
		if (thruUTC) {
			filterConditions.push(`createdon lt ${thruUTC}`);
		}
	}
	
	// User name filter (optional)
	if (HasValue(unam)) {
		filterConditions.push(`contains(lv_userfullname, '${unam}')`);
	}
	
	// Kind filter (optional)
	if (HasValue(kind)) {
		filterConditions.push(`contains(lv_kind, '${kind}')`);
	}
	
	// Detail filter (optional)
	if (HasValue(detl)) {
		filterConditions.push(`contains(lv_detail, '${detl}')`);
	}
	
	// Add filter clause if we have conditions
	if (filterConditions.length > 0) {
		url += "&$filter=" + filterConditions.join(' and ');
	}
	
	// Add order by clause (orderBy now includes direction)
	url += `&$orderby=${orderBy}`;
	
	// Add top clause to limit results
	url += "&$top=100";
	
	return url;
} // getLogQueryUrl

async function btnLogQuery_Click() {
	try {
		// Build the query URL from form inputs
		const url = getLogQueryUrl();
		
		// Update the URL display field
		$('#txtLogUrl').val(url);
		
		// Show loading indicator in results area
		say('Querying logs...');
		
		// Execute the API call
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			}
		});
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		const logRows = data.value || [];
		
		// Fill the log table with the results
		logTableFill(logRows);
		
		// Update results area with summary
		say(`Query completed successfully. Found ${logRows.length} log entries.`);
		
		// Apply any existing client-side filtering
		const filterTextbox = document.getElementById('txtUserFilterRx');
		if (filterTextbox) {
			filterTextbox.dispatchEvent(new Event('input'));
		}
		
		return false; // Prevent form submission
		
	} catch (error) {
		say(`Error querying logs: ${error.message}`);
		console.error('Log query error:', error);
		return false;
	}
} // btnLogQuery_Click

/**
 * Fills the log table with data from an array of log objects
 * @param {Array} arrRows - Array of log objects with properties matching the original Liquid template
 */
 function logTableFill(arrRows) {
    // Get reference to the table body
    const tableBody = document.getElementById('logTableBody');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Loop through the array and create a row for each log entry
    arrRows.forEach(log => {
        // Create a new row
        const row = document.createElement('tr');
        row.className = 'log-row';
        
        // Add data attribute for username if it exists
        if (log.lv_userfullname) {
            row.setAttribute('data-username', log.lv_userfullname);
        }
        
        // Format the date as NYC time
        let formattedDate = '';
        let fullISOTime = '';
        if (log.createdon) {
            const date = new Date(log.createdon);
            
            // Store full ISO format for tooltip
            fullISOTime = date.toISOString();
            
            // Convert UTC to NYC time (EST/EDT)
            // Since the database stores UTC, and NYC is UTC-5 (EST) or UTC-4 (EDT)
            // We need to SUBTRACT the offset to get NYC time from UTC
            // But JavaScript Date automatically converts to local time, so let's just use that
            // The original approach was working - let's go back to simple local time display
            
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayName = days[date.getDay()];
            
            // Format time with leading zeros - use local time (excluding seconds)
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            formattedDate = `${dayName} ${hours}:${minutes}`;
        }
        
        // Create cells with log data
        const cellsData = [
            { text: formattedDate, tooltip: fullISOTime },  // Time with tooltip
            { text: log.lv_userfullname || '', tooltip: null },    // User
            { text: log.lv_kind || '', tooltip: null },            // Kind
            { text: log.lv_detail || '', tooltip: null },          // Detail
            { text: log.lv_key1name || '', tooltip: null },        // K1Name
            { text: log.lv_key1value || '', tooltip: null },       // K1Value
            { text: log.lv_key2name || '', tooltip: null },        // K2Name
            { text: log.lv_key2value || '', tooltip: null },       // K2Value
            { text: log.lv_memo || '', tooltip: null }             // Memo
        ];
        
        // Add all cells to the row
        cellsData.forEach(cellData => {
            const cell = document.createElement('td');
            cell.textContent = cellData.text;
            if (cellData.tooltip) {
                cell.title = cellData.tooltip;
            }
            row.appendChild(cell);
        });
        
        // Add the row to the table body
        tableBody.appendChild(row);
    });
}

function updateLogQueryUrl() { // Called whenever any of the query controls is changed
	const url = getLogQueryUrl();
	$('#txtLogUrl').val(url);
}

const setDefaultLogQueryFromDate = () => {
	// Get current date and set to midnight in local time
	const now = new Date();
	const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
	
	// Format as YYYY-MM-DD HH:MM:SS (user-friendly local time format)
	const year = todayMidnight.getFullYear();
	const month = String(todayMidnight.getMonth() + 1).padStart(2, '0');
	const day = String(todayMidnight.getDate()).padStart(2, '0');
	const hours = String(todayMidnight.getHours()).padStart(2, '0');
	const minutes = String(todayMidnight.getMinutes()).padStart(2, '0');
	const seconds = String(todayMidnight.getSeconds()).padStart(2, '0');
	
	const localTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	
	// Set the value
	const txtLogFrom = $('#txtLogFrom');
	if (txtLogFrom.length) {
		txtLogFrom.val(localTimeString);
	} else {
		console.warn('txtLogFrom element not found in DOM');
	}
};


/**
 * Converts a local time string to UTC ISO format for API queries
 * @param {string} localTimeString - Time in format "YYYY-MM-DD HH:MM:SS" assumed to be local time
 * @returns {string} UTC time in ISO format for OData queries
 */
function convertLocalTimeToUTC(localTimeString) {
	if (!localTimeString || localTimeString.trim() === '') {
		return '';
	}
	
	try {
		// Parse the local time string (assume format: YYYY-MM-DD HH:MM:SS)
		const parts = localTimeString.trim().split(' ');
		if (parts.length !== 2) {
			// Try to handle just date part
			if (parts.length === 1 && parts[0].includes('-')) {
				parts.push('00:00:00'); // Add midnight time
			} else {
				console.warn('Invalid time format, expected YYYY-MM-DD HH:MM:SS');
				return '';
			}
		}
		
		const datePart = parts[0];
		const timePart = parts[1];
		
		const [year, month, day] = datePart.split('-').map(num => parseInt(num));
		const [hours, minutes, seconds] = timePart.split(':').map(num => parseInt(num));
		
		// Create date in local time
		// JavaScript Date constructor creates a date in local time
		const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
		
		// Convert to UTC using built-in method (handles timezone conversion automatically)
		return localDate.toISOString();
	} catch (error) {
		console.warn('Error converting local time to UTC:', error, 'Input:', localTimeString);
		return '';
	}
}

/**
 * Applies a preset filter pattern to the user filter textbox
 */
function applyUserFilterPreset() {
	const dropdown = document.getElementById('ddlUserFilterPresets');
	const textbox = document.getElementById('txtUserFilterRx');
	
	if (dropdown && textbox && dropdown.value) {
		textbox.value = dropdown.value;
		
		// Reset dropdown to default
		dropdown.selectedIndex = 0;
		
		// Trigger the input event to apply the filter
		textbox.dispatchEvent(new Event('input'));
	}
}

// #endregion LogQuery

// #region Helper
function updateApiUrl() {
	const prefix = $("#cboPrefix").val() || "";
	const action = $("#cboAction").val() || "";
	const id = $("#cboId").val() || "";

	let url = getUrl();
	const isBC = url.Has("businesscentral");
	const tableNamePlural = getTableNamePlural(url);

	url += "/" + tableNamePlural;

	let suffix = "";
	if (action.Is("Top10")) {
		suffix = "?$top=10";
	} else if (action.Is("Count")) {
		suffix = "/?$count=true&$top=1";
	} else if (action.Is("Filter")) {
		suffix = "/?$filter=lv_name eq 'Rodj'";
	} else if (action.Is("Top1")) {
		suffix = "?$top=1";
	} else if (action.Is("Select")) {
		suffix = "&$select=nickname,emailaddress1";
	} else if (action.Is("Id")) {
		suffix = "(" + id + ")";
	}

	url += suffix;

	$("#apiUrl").val(url);
}

function getUrl() {
	const prefix = $("#cboPrefix").val() || "";

	if (prefix.Is("BCODataV4LVM")) {
		url = "https://api.businesscentral.dynamics.com/v2.0/1598698c-cbd2-4d4a-94f0-0b4b2b701763/SandboxDev/ODataV4/Company('LVM')";
	} else if (prefix.Is("BCODataV4")) {
		url = "https://api.businesscentral.dynamics.com/v2.0/1598698c-cbd2-4d4a-94f0-0b4b2b701763/SandboxDev/ODataV4";
	} else if (prefix.Is("PowerPages")) {
		url = "/_api";
	} else if (prefix.Is("Dataverse")) {
		url = "/api/data/v9.2";
	}

	return url;
}

function getTableNamePlural(url = "") {
	const isBC = url.Has("businesscentral");
	const friendlyName = $("#cboTable").val() || "";

	const realName = friendlyTableNameToPlural(friendlyName, isBC);

	return realName;
}

function friendlyTableNameToPlural(baseName, isBC) {
	if (baseName.BeginsWith("account"))
		return isBC ? "accounts" : "accounts";

	if (baseName.Is("ApprovalLO"))
		return isBC ? "commPeriodLOApprovals" : "who cares, not used";

	if (baseName.Is("Branch"))
		return isBC ? "todo" : "lv_lvcompbranchs";

	if (baseName.Is("CommissionApproval"))
		return isBC ? "todo" : "lv_lvcompcommissionapprovals";

	if (baseName.Is("CommissionProfile"))
		return isBC ? "todo" : "lv_lvcompcommissionprofiles";

	if (baseName.Is("CommissionValue"))
		return isBC ? "todo" : "lv_lvcompcommissionvalues";

	if (baseName.Is("contact"))
		return isBC ? "contacts" : "contacts";

	if (baseName.Is("EmailLog"))
		return isBC ? "todo" : "lv_lvcompemaillogs";

	if (baseName.Is("Loan"))
		return isBC ? "todo" : "lv_lvcomploans";

	if (baseName.Is("LoanOfficer"))
		return isBC ? "todo" : "lv_lvcomploanofficers";

	if (baseName.Is("Log"))
		return isBC ? "not applicable" : "lv_logs";

	if (baseName.Is("RBLO"))
		return isBC ? "todo" : "lv_contactbranchassignments";  // Note: Old RBLO table replaced by lv_contactbranchassignment + lv_contactloanofficerrelationship

	throw "friendlyTableNameToPlural: unhandled: " + baseName;
}

function clearResults() {
	const resultsArea = document.getElementById('resultsArea');
	resultsArea.value = '';
}

function say(text) {
	const resultsArea = document.getElementById('resultsArea');
	resultsArea.value += (resultsArea.value ? '\n\n' : '') + text;

	// Auto-scroll to bottom
	resultsArea.scrollTop = resultsArea.scrollHeight;
}
// #endregion Helper

// #region URL Success History Management

/**
 * Saves a successful URL request to local storage
 * @param {string} url - The URL of the request
 * @param {string} verb - The HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {*} postData - Optional data sent with the request (null for GET requests)
 */
 function saveUrlSuccess(url, verb, postData = null) {
    // Get the existing history from local storage
    const historyString = localStorage.getItem('colUrlHistory');
    const history = historyString ? JSON.parse(historyString) : [];
    
    // Format current timestamp (to the nearest minute)
    const now = new Date();
	const timestamp = now.toLocaleString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: '2-digit'
	});

    // Convert postData to string for comparison if it's an object
    const postDataString = postData !== null ? 
        (typeof postData === 'object' ? JSON.stringify(postData) : postData) : 
        null;
    
    // Check if this exact combination already exists
    const exists = history.some(item => 
        item.url === url && 
        item.verb === verb && 
        (
            (item.postData === null && postDataString === null) ||
            (item.postData !== null && postDataString !== null && 
             item.postData === postDataString)
        )
    );
    
    // If this combination doesn't exist, add it to history
	// unshift is inverse of push
    if (exists) {
	} else {

        history.unshift({
            timestamp,
            url,
            verb,
            postData: postDataString
        });
        
        // Save updated history back to local storage
        localStorage.setItem('colUrlHistory', JSON.stringify(history));
    }
}

/**
 * Loads the success history into the dropdown
 */
function loadSuccessHistory() {
    const $dropdown = $('#cboUrlSuccessHistory');
    
    // Clear existing options
    $dropdown.empty();
    
    // Add a default empty option
    $dropdown.append($('<option>', {
        value: '',
        text: '-- Select Previous Request --'
    }));
    
    // Get history from local storage
    const historyString = localStorage.getItem('colUrlHistory');

    if (!historyString) {
		return;
	}

    const history = JSON.parse(historyString);
    
    // Populate dropdown with history items
    $.each(history, function(index, item) {
        // Format display text (URL + timestamp + verb if not GET)
        let displayText = `${item.url} (${item.timestamp})`;
        if (item.verb !== 'GET') {
            displayText += ` ${item.verb}`;
        }
        
        $dropdown.append($('<option>', {
            value: index,
            text: displayText
        }));
    });
    
    // Add change event listener
    $dropdown.on('change', handleHistorySelection);
}

/**
 * Handles selection from the history dropdown
 */
function handleHistorySelection() {
    const $dropdown = $('#cboUrlSuccessHistory');
    const selectedIndex = $dropdown.val();
    
    // If no selection (first option), do nothing
    if (selectedIndex === '') return;
    
    // Get history from local storage
    const historyString = localStorage.getItem('colUrlHistory');
    const history = JSON.parse(historyString);
    
    // Get the selected history item
    const selectedItem = history[selectedIndex];
    
    // Populate the form fields
    $('#apiUrl').val(selectedItem.url);
    $('#apiMethod').val(selectedItem.verb);
    
    // Handle post data if present
    if (selectedItem.postData) {
        try {
            // Try to parse and pretty-print if it's JSON
            const parsedData = JSON.parse(selectedItem.postData);
            $('#postDataArea').val(JSON.stringify(parsedData, null, 2));
        } catch (e) {
            // If not valid JSON, just set as is
            $('#postDataArea').val(selectedItem.postData);
        }
    } else {
        $('#postDataArea').val('');
    }
}
// #endregion URL Success History Management

// #region Doc Load

function initializeApp() {
	$('#spanJsVersion').html(version());

	updateApiUrl();

	initPersistentControls();

    loadSuccessHistory();
	
	// Make sure critical functions are globally accessible for onclick handlers
	window.callSelectedFunction = callSelectedFunction;
	window.updateAllContactRoles = updateAllContactRoles;
	console.log('Functions made globally accessible - callSelectedFunction:', typeof window.callSelectedFunction);

    const filterTextbox = document.getElementById('txtUserFilterRx');

    // Check if element exists before accessing its properties
    if (filterTextbox) {
        // Set default filter to exclude "Robert Martin"
        filterTextbox.value = "^(?!Robert Martin$).*$";

        // Apply initial filtering
        applyClientSideLogRowsFilter();

        // Add event listener for changes to the filter textbox
        filterTextbox.addEventListener('input', applyClientSideLogRowsFilter);
    } else {
        console.warn('txtUserFilterRx element not found in DOM');
    }

    // Function to apply the filtering
    function applyClientSideLogRowsFilter() {
        if (!filterTextbox) return;
        const filterValue = filterTextbox.value.trim();
        let regex;

        try {
            regex = new RegExp(filterValue, 'i'); // 'i' for case-insensitive
        } catch (error) {
            regex = /.*/;
        }

        // Get all rows in the table
        const rows = document.querySelectorAll('.log-row');

        rows.forEach(row => {
            const username = row.getAttribute('data-username') || '';
            row.style.display = regex.test(username) ? '' : 'none';
        });
    }

    const divMain = document.getElementById("divMain");
    if (divMain) {
        divMain.style.display = "block";
    } else {
        console.warn('divMain element not found in DOM');
    }

	setDefaultLogQueryFromDate();
	
	// Make user filter preset function globally accessible
	window.applyUserFilterPreset = applyUserFilterPreset;
}

document.addEventListener('LVGlobalDOCReady', function () {

	try {
		handleMsalRedirect();
	} catch {
		console.error("ERROR: Handlemsalredirect 2503140657")
	}

	// I had originally wanted to use async and await, but I never could get
	// it to work, and AI suggested use of Promise so as to clearly 
	// separate the calls, while still making it clear that both (load of
	// jQuery and call to initializeApp) happen in sequential order
    loadJqueryAndBootstrap().then(() => {
        // Then initialize the app
        initializeApp();
        
    });
});

// #endregion DocLoad

/**
 * Updates all contact records' lv_roles field based on their actual web role assignments
 * This function implements the same logic as the Contact Form's updateRolesField() function
 * @param {boolean} testMode - If true, only processes first 5 contacts and shows detailed debug info
 */
async function updateAllContactRoles(testMode = false) {
	try {
		say('=== STARTING BULK lv_roles UPDATE ===');
		
		// Step 1: Get contact records with their current lv_roles field
		say(`Step 1: Fetching ${testMode ? 'test subset of ' : 'all '}contact records...`);
		const maxContacts = testMode ? 5 : 0; // Limit to 5 for testing, 0 = no limit for production
		const contacts = await apiGetRecords('contacts', '$select=contactid,fullname,emailaddress1,lv_roles,lv_branch,lv_loanofficer', maxContacts);
		say(`Found ${contacts.length} total contacts${testMode ? ' (TEST MODE)' : ''}`);
		
		// Step 2: Get all web role assignments using correct association table name
		say('Step 2: Fetching web role assignments...');
		const roleAssignments = await apiGetRecords('powerpagecomponent_mspp_webrole_contacts', '$expand=mspp_webrole($select=mspp_webroleid,mspp_name)', 0);
		say(`Found ${roleAssignments.length} total role assignments`);
		
		// Step 3: Get web roles for reference
		say('Step 3: Fetching web role definitions...');
		const webRoles = await apiGetRecords('mspp_webroles', '$select=mspp_webroleid,mspp_name', 0);
		say(`Found ${webRoles.length} web roles`);
		
		// Create role ID to name mapping
		const roleIdToName = {};
		webRoles.forEach(role => {
			roleIdToName[role.mspp_webroleid] = role.mspp_name;
		});
		
		// Also map from roleAssignments if expanded data is available
		roleAssignments.forEach(assignment => {
			if (assignment.mspp_webrole && assignment.mspp_webrole.mspp_webroleid) {
				roleIdToName[assignment.mspp_webrole.mspp_webroleid] = assignment.mspp_webrole.mspp_name;
			}
		});
		
		say(`Role mapping created with ${Object.keys(roleIdToName).length} roles`);
		
		// Step 4: Get branch and loan officer assignments (NEW TABLES)
		say('Step 4: Fetching branch and loan officer assignments...');
		const branchAssignments = await apiGetRecords('lv_contactbranchassignments', '$select=lv_contact,lv_branch,lv_branchcode', 0);
		say(`Found ${branchAssignments.length} Branch Manager assignments (lv_contactbranchassignment)`);
		const loRelationships = await apiGetRecords('lv_contactloanofficerrelationships', '$select=lv_contact,lv_loanofficer,lv_loanofficercode,lv_relationshiptype', 0);
		const looAssignments = loRelationships.filter(r => r.lv_relationshiptype === 'O');
		say(`Found ${looAssignments.length} Loan Officer Oversight assignments (lv_contactloanofficerrelationship type=O)`);
		
		// Step 5: Process each contact
		say('Step 5: Processing contacts and calculating correct lv_roles...');
		let updatedCount = 0;
		let errorCount = 0;
		let skippedCount = 0;
		
		for (let i = 0; i < contacts.length; i++) {
			const contact = contacts[i];
			const contactId = contact.contactid;
			
			try {
				// Calculate what the lv_roles field should be for this contact
				const correctRolesString = calculateContactRoles(contact, roleAssignments, roleIdToName, branchAssignments, looAssignments);
				const currentRolesString = contact.lv_roles || '';
				
				// In test mode, show detailed debug info for each contact
				if (testMode) {
					const contactRoleAssignments = roleAssignments.filter(ra => ra.contactid === contactId);
					say(`\n--- Contact ${i + 1}: ${contact.fullname || contact.emailaddress1 || contactId} ---`);
					say(`Current lv_roles: "${currentRolesString}"`);
					say(`Calculated roles: "${correctRolesString}"`);
					say(`Has web role assignments: ${contactRoleAssignments.length}`);
					say(`Legacy branch: ${contact.lv_branch || 'none'}`);
					say(`Legacy loan officer: ${contact.lv_loanofficer || 'none'}`);
					
					if (contactRoleAssignments.length > 0) {
						contactRoleAssignments.forEach(ra => {
							const roleName = ra.mspp_webrole?.mspp_name || roleIdToName[ra.mspp_webroleid] || 'Unknown';
							say(`  - Web role: ${roleName}`);
						});
					}
				}
				
				// Only update if the roles have changed
				if (currentRolesString !== correctRolesString) {
					if (!testMode) {
						say(`Contact ${contact.fullname || contact.emailaddress1 || contactId}: "${currentRolesString}" -> "${correctRolesString}"`);
					}
					
					// In test mode, don't actually update - just show what would happen
					if (testMode) {
						say(`  >>> WOULD UPDATE: "${currentRolesString}" -> "${correctRolesString}"`);
					} else {
						// Update the contact record using _api endpoint
						const response = await apiCall(`/_api/contacts(${contactId})`, 'PATCH', { lv_roles: correctRolesString });
					}
					updatedCount++;
				} else {
					if (testMode) {
						say(`  >>> NO CHANGE NEEDED`);
					}
					skippedCount++;
				}
				
				// Progress indicator every 25 contacts (or every contact in test mode)
				if (testMode || (i + 1) % 25 === 0) {
					if (!testMode) {
						say(`Processed ${i + 1}/${contacts.length} contacts... (${updatedCount} updated, ${skippedCount} unchanged, ${errorCount} errors)`);
					}
				}
				
			} catch (contactError) {
				say(`ERROR processing contact ${contactId}: ${contactError.message}`);
				errorCount++;
			}
		}
		
		say('=== BULK UPDATE COMPLETE ===');
		say(`Total contacts processed: ${contacts.length}`);
		say(`Records updated: ${updatedCount}`);
		say(`Records unchanged: ${skippedCount}`);
		say(`Errors: ${errorCount}`);
		
	} catch (error) {
		say(`FATAL ERROR: ${error.message}`);
		console.error('updateAllContactRoles error:', error);
	}
}

/**
 * Calculates what the lv_roles field should contain for a specific contact
 * Explicitly checks for all possible roles: Administrators, Branch Manager, Loan Officer, Developer, LoanVision, RoleAssign
 */
function calculateContactRoles(contact, roleAssignments, roleIdToName, branchAssignments, looAssignments) {
	const contactId = contact.contactid;
	
	// Get current roles from contact's web role assignments
	const contactRoleAssignments = roleAssignments.filter(ra => ra.contactid === contactId);
	
	// Extract role names from assignments, handling both direct roleId and expanded data
	const assignedRoleNames = [];
	contactRoleAssignments.forEach(ra => {
		let roleName = null;
		
		// Try to get role name from expanded data first
		if (ra.mspp_webrole && ra.mspp_webrole.mspp_name) {
			roleName = ra.mspp_webrole.mspp_name;
		}
		// Fallback to lookup by ID
		else if (ra.mspp_webroleid && roleIdToName[ra.mspp_webroleid]) {
			roleName = roleIdToName[ra.mspp_webroleid];
		}
		// Another fallback if different field name
		else if (ra.powerpagecomponentid && roleIdToName[ra.powerpagecomponentid]) {
			roleName = roleIdToName[ra.powerpagecomponentid];
		}
		
		if (roleName) {
			assignedRoleNames.push(roleName);
		}
	});
	
	// Array to collect all roles this contact should have
	const finalRoles = [];
	
	// 1. Administrators - based on actual web role assignment
	if (assignedRoleNames.includes('Administrators')) {
		finalRoles.push('Administrators');
	}
	
	// 2. Branch Manager - based on branch assignments (auto-managed)
	// Check NEW lv_contactbranchassignment table
	let hasBranchAssignment = false;

	// Check new assignment system (contact is branch manager via lv_contactbranchassignment)
	if (branchAssignments.some(ba => ba.lv_contact === contactId)) {
		hasBranchAssignment = true;
	}

	// Check legacy branch assignment (contact.lv_branch field) - no longer used for permissions
	// if (contact.lv_branch && contact.lv_branch !== null) {
	// 	hasBranchAssignment = true;
	// }

	if (hasBranchAssignment) {
		finalRoles.push('Branch Manager');
	}

	// 3. Loan Officer - based on loan officer assignments (auto-managed)
	// Check NEW lv_contactloanofficerrelationship table (type='O' for oversight)
	let hasLoanOfficerAssignment = false;

	// Check new assignment system (contact has loan officer oversight via lv_contactloanofficerrelationship)
	if (looAssignments && looAssignments.some(loo => loo.lv_contact === contactId)) {
		hasLoanOfficerAssignment = true;
	}

	// Check legacy loan officer assignment (contact.lv_loanofficer field)
	if (contact.lv_loanofficer && contact.lv_loanofficer !== null) {
		hasLoanOfficerAssignment = true;
	}

	if (hasLoanOfficerAssignment) {
		finalRoles.push('Loan Officer');
	}
	
	// 4. Developer - based on actual web role assignment
	if (assignedRoleNames.includes('Developer')) {
		finalRoles.push('Developer');
	}
	
	// 5. LoanVision - based on actual web role assignment
	if (assignedRoleNames.includes('LoanVision')) {
		finalRoles.push('LoanVision');
	}
	
	// 6. RoleAssign - based on actual web role assignment (note: no space in name)
	if (assignedRoleNames.includes('RoleAssign')) {
		finalRoles.push('RoleAssign');
	}
	
	// Sort alphabetically and join with comma-space
	return finalRoles.sort().join(', ');
}

function version() {
	return "lvcpdev.js this one DOES have en-US";
}
// Last modified sat aug 16 6:20pm
// Last modified sat aug 16 6:38pm
<!-- Last modified Fri Oct 31 8:04AM -->
<!-- Last modified Fri Oct 31 8:45AM -->