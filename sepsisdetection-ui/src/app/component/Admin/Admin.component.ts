import { Component, OnInit, ElementRef, ViewChild ,Input} from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { ProcessInstanceList,TaskInstanceList, TaskInstance } from 'src/app/Models/Requests/Request';
import { BackendServices } from 'src/app/service/BackendServices';
import { UserRole } from 'src/app/Models/UserRole';
import { RiskEvaluvationComponent } from '../Modals/RiskEvaluvation/RiskEvaluvation.component';
import { RiskMitigationComponent } from '../Modals/RiskMitigation/RiskMitigation.component';
import { Bundle } from './Bundle';
import { faRecycle } from '@fortawesome/free-solid-svg-icons';
import { forkJoin } from 'rxjs';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';

@Component({
  selector: 'app-Admin',
  templateUrl: './Admin.component.html',
  styleUrls: ['./Admin.component.css']
})
export class AdminComponent implements OnInit {

  @ViewChild("svgContent") svgContentElement: ElementRef;
  @ViewChild("svgContentSubProcess") svgSubContentElement: ElementRef;
  @ViewChild("svgContentClosed") svgContentElementClosed: ElementRef;

  bundle : Bundle;
  faRecycle = faRecycle;

  @Input() user : UserRole;
  closeResult: string = "";
  activeProcessInstances: ProcessInstanceList[] = new Array();
  closedProcessInstances: ProcessInstanceList[] = new Array();
  activeManagerTasks : TaskInstanceList = {
    instanceList : new Array()
  };
  svgContent : string = "";
  allowSvgContent : boolean = false;
  service: BackendServices;
  keycloak: KeycloakService;

  public isLoggedIn = false;
  public isAdminUser = false;
  public userProfile: KeycloakProfile | null = null;

 

   constructor(private modalService: NgbModal, service : BackendServices, keycloak: KeycloakService) {
      this.service = service;
      this.keycloak = keycloak;
      this.bundle = new Bundle();
   }

  public async ngOnInit() {
    this.getCaseList();

    this.isLoggedIn = await this.keycloak.isLoggedIn();
    this.isAdminUser = this.keycloak.isUserInRole("Administrators");

    if (this.isLoggedIn) {
      this.userProfile = await this.keycloak.loadUserProfile();
    }
  }

  private getCaseList() {
    this.activeProcessInstances = new Array();
    this.activeManagerTasks = {
      instanceList : new Array()
    }
    this.service.getProcessInstances("Active").subscribe((res: any) => {
      this.buildCaseList(res, this.activeProcessInstances, "Active");
    }, err => { console.log(err) });
  }

  private buildCaseList(response: any, caseList: ProcessInstanceList[], type: string) {
    let currentStatus = "Active";
    if (type != "Active")
      currentStatus = "Completed";

    if (response["process-instance"] && response["process-instance"] instanceof Array) {
      response["process-instance"].forEach((instance: any) => {
        let processInstance: ProcessInstanceList = {
          processInstanceId: instance["process-instance-id"],
          status: currentStatus,
          startedDate: instance["start-date"]["java.util.Date"],
          name: instance["process-instance-desc"]
        }
        if(instance["parent-instance-id"] == -1)
            caseList.push(processInstance);
        else
            {
              caseList.forEach((localInstance : ProcessInstanceList) =>
              {
                  if(localInstance.processInstanceId == instance["parent-instance-id"])
                  {
                      localInstance.subProcess = instance;
                  }
              });
            }    
      });
      caseList = caseList.sort((a: ProcessInstanceList, b: ProcessInstanceList) => {
        if (a.processInstanceId >= b.processInstanceId)
          return -1;
        else
          return 1;
      });

      if (type == "Active")
        this.buildVariablesList(caseList);
    }
  }

  private buildVariablesList(caseList: ProcessInstanceList[]) {
    caseList.forEach((currentInstance: ProcessInstanceList) => {
      this.service.getProcessInstanceVariables(currentInstance.processInstanceId).subscribe((res: any) => {
         this.mapVariableNameValue(res,currentInstance);
         this.onGetActiveTask();
      }, err => {

      });
    });

  }

  private mapVariableNameValue(res : any,caseInstance : ProcessInstanceList)
  {
    if(res.observation)
    {
        let observationObj = JSON.parse(res.observation)
        caseInstance.resourceType = observationObj.resourceType;
        caseInstance.id = observationObj.id;
        caseInstance.eventStatus = observationObj.status;
        if(observationObj.code && observationObj.code.coding && observationObj.code.coding instanceof Array)
        {
            caseInstance.code = observationObj.code.text;
            caseInstance.value = observationObj.valueQuantity.value;
            caseInstance.unit = observationObj.valueQuantity.code;
        } 
    }
  }

  onShowFlow(processInstanceId : number,type : string,processInstance : ProcessInstanceList)
  {
      if(this.allowSvgContent)
        {
          this.allowSvgContent = false;
          return;
        }
      this.service.getSVGImage(processInstanceId).subscribe((res : any) => { 
        this.svgContent = res;
        if(type == "Active")
            this.svgContentElement.nativeElement.innerHTML = this.svgContent;
        else
            this.svgContentElementClosed.nativeElement.innerHTML = this.svgContent;

      },err=>{ console.error(err);});
      if(processInstance.subProcess)
      {
        this.service.getSVGImage(processInstance.subProcess["process-instance-id"]).subscribe((res : any) => { 
          this.svgSubContentElement.nativeElement.innerHTML = res;
        });
            
      }

      this.allowSvgContent = true;
  }

  onGetActiveTask() {
      
      if(this.isAdminUser) {
        this.service.getActiveTaskInstancesForBusinessAdmin().subscribe((res:any)=>{
          if(res["task-summary"] && res["task-summary"] instanceof Array)
          {
            res["task-summary"].forEach((task : any)=> {
                let taskInstance : TaskInstance = {
                  processInstanceId : task["task-proc-inst-id"],
                  taskCreatedDate : task["task-created-on"]["java.util.Date"],
                  taskId : task["task-id"],
                  taskStatus : task["task-status"],
                  taskName : task["task-name"],
                  taskSubject : task["task-subject"],
                  taskDescription  : task["task-description"]
                }
                this.activeManagerTasks.instanceList.push(taskInstance);
            });
          }
        },err=>{});
      }else {

        this.service.getActiveTaskInstancesForPotentialOwner(this.keycloak.getUserRoles()).subscribe((res:any)=>{
            if(res["task-summary"] && res["task-summary"] instanceof Array)
            {
              res["task-summary"].forEach((task : any)=> {
                  let taskInstance : TaskInstance = {
                    processInstanceId : task["task-proc-inst-id"],
                    taskCreatedDate : task["task-created-on"]["java.util.Date"],
                    taskId : task["task-id"],
                    taskStatus : task["task-status"],
                    taskName : task["task-name"],
                    taskSubject : task["task-subject"],
                    taskDescription  : task["task-description"]
                  }
                  this.activeManagerTasks.instanceList.push(taskInstance);
              });
            }
        },err=>{});
        
      }
  }

  getTaskVaribles(taskid : number,taskInstance: TaskInstance) {
      this.service.getTaskVariables(taskid).subscribe((res:any) => {
        console.log(res);
        if(taskInstance.taskName == "Primary Doctor Evaluates Risk" || taskInstance.taskName == "On Call Doctor Evaluates Risk") 
            this.openRiskEvaluvation(res,taskInstance);
        else if(taskInstance.taskName == "Licensed Provider Determines Patient Disposition" || taskInstance.taskName == "Escalation Licensed Provider Disposition") 
            this.openRiskMitigation(res,taskInstance);
      },err => {})
  }


   private openRiskEvaluvation(response : any,taskInstance: TaskInstance) {
    const modalRef = this.modalService.open(RiskEvaluvationComponent, { ariaLabelledBy: 'modal-basic-title', size: 'xl', backdrop: 'static' });

    modalRef.result.then((result) => {
      this.getCaseList();
    }, (reason) => {
      this.closeResult = "Dismissed";
      this.getCaseList();
    });

    modalRef.componentInstance.taskResponse = response;
    modalRef.componentInstance.currentUser = this.user;
    modalRef.componentInstance.taskInstance = taskInstance;
  } 

  private openRiskMitigation(response : any,taskInstance : TaskInstance) {
    const modalRef = this.modalService.open(RiskMitigationComponent, { ariaLabelledBy: 'modal-basic-title', size: 'xl', backdrop: 'static' });

    modalRef.result.then((result) => {
      this.getCaseList();
    }, (reason) => {
      this.closeResult = "Dismissed";
      this.getCaseList();
    });

    modalRef.componentInstance.taskResponse = response;
    modalRef.componentInstance.currentUser = this.user;
    modalRef.componentInstance.taskInstance = taskInstance;
  }

  onAbort(instance : ProcessInstanceList) {
    this.service.signalEvent(instance.processInstanceId,"Stop Process",{}).subscribe((res : any) => {
      console.log("Process Aborted : " + instance.processInstanceId);
    });
  }

  

  onReset() {
     let serviceArray = new Array();
     this.activeProcessInstances.forEach((instance : ProcessInstanceList) => {
        serviceArray.push(this.service.signalEvent(instance.processInstanceId,"Stop Process",{}));
     });
     

     if(serviceArray.length == 0)
      this.createBundle();
     else
     {
      forkJoin(serviceArray).subscribe(data => {
        this.createBundle();
      });
     }
     
  }

  refreshScreen()
  {
    window.alert("Reset Complete. Page will be refreshed");
    location.reload();
    
  }

  private createBundle() {
    var data = JSON.parse(this.service.getCurrentBundleData());
    this.service.createBundle(data).subscribe((bundleResp : any) => {
      console.log(bundleResp);
      this.getCaseList();
      setTimeout(this.refreshScreen,5000)
    });
  }

}
