import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CookieService } from 'ngx-cookie';
import { KieSettings } from '../Models/KieSettings/KieSettings';
import { Part, ServiceRequest, ProcessInstanceData, Claim, Policy } from '../Models/Requests/Request';
import { RootObject, Command, Insert } from '../Models/Requests/Request';
import { Credentials } from '../Models/UserRole';
import { Applicant } from '../Models/Requests/Request';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PAMServices {

  private kieSettings: KieSettings;

  constructor(private http: HttpClient, private cookieService: CookieService) {
    this.kieSettings = <KieSettings>this.cookieService.getObject("kieSettingsHIMMS")
    if (this.kieSettings === undefined) {
      this.kieSettings = {
        baseurl: environment.KIE_SERVER_URL,
        dmcontainerAlias: "",
        picontainerAlias: environment.PAM_CONTAINER_ALIAS,
        processId: environment.PROCESS_ID,
        username: environment.KIE_SERVER_USERID,
        password: environment.KIE_SERVER_PASSWORD,
        isOpenShift: false
      };
    }
    
  }

  updateKieSettings(kieSettings: KieSettings) {
    this.kieSettings = kieSettings;
    this.cookieService.putObject("kieSettingsHIMMS", this.kieSettings);
  }

  getCurrentKieSettings(): KieSettings {
    return this.kieSettings;
  }

  submitClaim(claim : Claim,policy : Policy)
  {
    let postData = {
      tClaim : {
        "com.property_insurance.model.Claim" : claim
      },
      tPolicy : {
        "com.property_insurance.model.Policy" : policy
      }
    };

    postData.tClaim['com.property_insurance.model.Claim'].accidentDate = postData.tClaim['com.property_insurance.model.Claim'].accidentDate + "T15:49:05.630Z";
    postData.tClaim['com.property_insurance.model.Claim'].filingDate = postData.tClaim['com.property_insurance.model.Claim'].filingDate + "T15:49:05.630Z";

    let url = this.kieSettings.baseurl + "/rest/server/containers/"+this.kieSettings.picontainerAlias+"/processes/"+this.kieSettings.processId+"/instances";
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
    }
    return this.http.post(url,postData,{ headers });
  }

  getProcessInstances(type: string) {
    let status: number;
    if (type == "Active")
      status = 1;
    else
      status = 2;
    let url = this.kieSettings.baseurl + "/rest/server/containers/" + this.kieSettings.picontainerAlias + "/processes/instances?status=" + status + "&page=0&pageSize=100&sortOrder=true";
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.get(url, { headers });

  }

  getProcessInstanceVariables(processInstanceId: number) {
    let url = this.kieSettings.baseurl + "/fhir/processes/instance/" + processInstanceId + "/variables";
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.get(url, { headers });

  }

  getSVGImage(processInstanceId: number) {
    let url = this.kieSettings.baseurl + "/rest/server/containers/" + this.kieSettings.picontainerAlias + "/images/processes/instances/" + processInstanceId +
      "?svgCompletedColor=%23d8fdc1&svgCompletedBorderColor=%23030303&svgActiveBorderColor=%23FF0000";
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'accept': 'application/svg+xml',
      'content-type': 'application/svg+xml'
    };
    return this.http.get(url, { headers, responseType: 'text' });
  }


  getActiveTaskInstances(processInstanceId: number) {
    let url = this.kieSettings.baseurl + "/rest/server/queries/tasks/instances/process/" + processInstanceId;
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.get(url, { headers });
  }

  getTaskVariables(taskInstanceId: number) {
    let url = this.kieSettings.baseurl + "/fhir/processes/taskinstance/"+taskInstanceId+ "/variables";
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.get(url, { headers });
  }


  updateTaskStatus(taskInstanceId: number, taskStatus: string) {
    let url = this.kieSettings.baseurl + "/rest/server/containers/" + this.kieSettings.picontainerAlias + "/tasks/" + taskInstanceId + "/states/" + taskStatus + "?user=" + this.kieSettings.username;
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.put(url, "", { headers });
  }

  updateVariables(taskInstanceId: number, data: any,cred : Credentials) {
    let url = this.kieSettings.baseurl + "/rest/server/containers/" + this.kieSettings.picontainerAlias + "/tasks/" + taskInstanceId + "/contents/output?user="+this.kieSettings.username;
    const headers = {
      'Authorization': 'Basic ' + btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };
    return this.http.put(url, data, { headers });
  }

  signalEvent(processInstanceId : number,signalName : string,shipmentRequest : any)
  {
    let url = this.kieSettings.baseurl + "/rest/server/containers/" + this.kieSettings.picontainerAlias + "/processes/instances/"+processInstanceId + "/signal/" + signalName;
    let postData = shipmentRequest;
    const headers = {
      'Authorization': 'Basic ' +  btoa(this.kieSettings.username + ":" + this.kieSettings.password),
      'content-type': 'application/json',
      'X-KIE-ContentType': 'JSON',
      'accept': 'application/json'
    };

    return this.http.post(url, postData, { headers });

  }


}
