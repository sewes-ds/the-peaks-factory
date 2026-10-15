export type ScreenId =
  | 'S01-N01'
  | 'S01-N02'
  | 'S01-N03'
  | 'S01-N04'
  | 'S01-N05'
  | 'S02-N01'
  | 'S02-N02'
  | 'S02-N02A'
  | 'S02-B02'
  | 'S02-N03'
  | 'S02-QR01'
  | 'S02-N04'
  | 'S02-SKU01'
  | 'S02-SKUQR01'
  | 'S02-N05'
  | 'S02-N08'
  | 'S02-B01'
  | 'S02-B03'
  | 'S02-N09'
  | 'S02-N26_keyboard'
  | 'S02-N27'
  | 'S02-N28'
  | 'S02-N10'
  | 'S02-N11'
  | 'S02-AW01'
  | 'S02-AW02'
  | 'S02-AW03A'
  | 'S02-AW03B'
  | 'S02-AW04'
  | 'S02-AW05'
  | 'S02-FS01'
  | 'S02-FS02'
  | 'S02-FS03'
  | 'S02-FS04'
  | 'S02-SAL01'
  | 'S02-SAL02'
  | 'S03-N01'
  | 'S03-M01'
  | 'S03-M02'
  | 'S03-M03O'
  | 'S03-M03C'
  | 'S03-M04C'
  | 'S03-D01'
  | 'S03-D10'
  | 'S03-D11'
  | 'S03-D12'
  | 'S03-D13'
  | 'S03-E01'
  | 'S03-E02'
  | 'S03-E10'
  | 'S03-E11'
  | 'S03-E12'
  | 'S03-E13'
  | 'S03-E14'
  | 'S03-E16'
  | 'S03-E17'
  | 'S03-E20'
  | 'S03-E21'
  | 'S03-E22'
  | 'S03-AW01'
  | 'S03-AW10'
  | 'S03-AW11'
  | 'S03-AW12'
  | 'S03-AW20'
  | 'S03-AW21'
  | 'S03-AW30'
  | 'S03-AW31'
  | 'S03-AW40'
  | 'S03-AW41'
  | 'S03-AW42'
  | 'S03-AW50'
  | 'S03-AW51'
  | 'S03-AW52'
  | 'S03-AW53'
  | 'S03-AW54'
  | 'S03-C00'
  | 'S03-CF01'
  | 'S03-CF10'
  | 'S03-CF11'
  | 'S03-CF12'
  | 'S03-CF13'
  | 'S03-CF14'
  | 'S03-CF20'
  | 'S03-CF21'
  | 'S03-CF22'
  | 'S03-CF23'
  | 'S03-CF24'
  | 'S03-CF25'
  | 'S03-CP00'
  | 'S03-CP10'
  | 'S03-CP11'
  | 'S03-CP12'
  | 'S03-CP13'
  | 'S03-CP14'
  | 'S03-CP15'
  | 'S03-CP16'
  | 'S03-CP20'
  | 'S03-SAL01'
  | 'S03-SAL02'
  | 'S03-NOT01'
  | 'S03-R01'
  | 'S03-R10'
  | 'S03-R11'
  | 'S03-R12'
  | 'S03-R13'
  | 'S03-R14'
  | 'S04-N01';

export type OperatorPipeline =
  | 'START_SHIFT'
  | 'FINISH_SHIFT'
  | 'START_PRODUCTION'
  | 'FINISH_PRODUCTION'
  | 'START_DOWNTIME'
  | 'FINISH_DOWNTIME'
  | 'START_BREAK'
  | 'FINISH_BREAK'
  | 'OPEN_ADDITIONAL_WORK'
  | 'START_ADDITIONAL_WORK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'REQUEST_ADDITIONAL_WORK'
  | 'VIEW_SALARY';

export type FinishShiftNextPipeline =
  | 'FINISH_DOWNTIME'
  | 'FINISH_BREAK'
  | 'FINISH_ADDITIONAL_WORK'
  | 'FINISH_PRODUCTION'
  | 'CONFIRM_FINISH_SHIFT'
  | 'CONFIRM_FINISH_SHIFT_WITH_WARNING'
  | null;

export type UiColorToken =
  | 'blue'
  | 'yellow'
  | 'scarlet'
  | 'green'
  | 'gray'
  | 'gray_green'
  | 'white_gray_inactive';

export type AdditionalWorkOrigin = 'OPERATOR_REQUEST_APPROVED' | 'MANAGER_ASSIGNED';

export type AdditionalWorkItem = {
  additional_work_id: string;
  additional_work_type_id: string;
  display_name: string;
};

export type ApprovedAdditionalWorkItem = AdditionalWorkItem & {
  origin: AdditionalWorkOrigin;
  ui_group: 'APPROVED';
  ui_color_token: 'gray_green';
  action: 'START_ADDITIONAL_WORK';
};

export type PendingAdditionalWorkItem = AdditionalWorkItem & {
  ui_group: 'PENDING_APPROVAL';
  ui_color_token: 'white_gray_inactive';
  action: null;
};

export type ActiveAdditionalWorkItem = AdditionalWorkItem & {
  ui_group: 'ACTIVE';
  ui_color_token: 'green';
  action: 'FINISH_ADDITIONAL_WORK';
};

export type OperatorAdditionalWorkStateResponse = {
  actor_employee_id: string;
  active_additional_works: ActiveAdditionalWorkItem[];
  approved_additional_works: ApprovedAdditionalWorkItem[];
  pending_approval_additional_works: PendingAdditionalWorkItem[];
};

export type AdditionalWorkTypesAvailableResponse = {
  additional_work_types: Array<{
    additional_work_type_id: string;
    display_name: string;
  }>;
};

export type MachineQrLookupResponse =
  | {
      found: true;
      machine: {
        machine_id: string;
        machine_name: string;
        workshop_name: string | null;
        machine_status: string | null;
        machine_use_status: string | null;
        is_selectable_for_production: boolean;
        is_selectable_for_critical_downtime: boolean;
        ui_status_token: 'normal' | 'busy' | 'critical' | 'unavailable';
        production_unavailability:
          | { code: 'OCCUPIED_BY_OPERATOR'; operator_full_name: string }
          | { code: 'MACHINE_BROKEN' }
          | { code: 'MACHINE_DOWNTIME' }
          | { code: 'MACHINE_OUT_OF_SERVICE' }
          | { code: 'MACHINE_NOT_READY'; machine_status: string | null }
          | null;
      };
    }
  | {
      found: false;
      error_code: 'MACHINE_QR_NOT_FOUND';
    };

export type MachineQrFlowResponse =
  | MachineQrLookupResponse
  | { found: false; error_code: 'SCANNER_UNAVAILABLE' | 'SCANNER_CANCELLED' | 'MACHINE_QR_LOOKUP_FAILED' };

export type SkuQrLookupResponse =
  | {
      found: true;
      sku: {
        sku_id: string;
        sku_code: string;
        sku_name: string;
        sku_unit_name: string | null;
        current_sku_tariff_uzs: number | null;
        is_active: boolean;
        is_selectable_for_production: boolean;
        production_unavailability: { code: 'SKU_INACTIVE' } | null;
      };
    }
  | { found: false; error_code: 'SKU_QR_NOT_FOUND' };

export type SkuQrFlowResponse =
  | SkuQrLookupResponse
  | { found: false; error_code: 'SCANNER_UNAVAILABLE' | 'SCANNER_CANCELLED' | 'SKU_QR_LOOKUP_FAILED' };

export type RouteState = {
  screenId: ScreenId;
  pipeline?: OperatorPipeline;
};

export type PipelineLocalContext = {
  selected_machine_id?: string;
  selected_machine_name?: string;
  selected_sku_id?: string;
  selected_break_type_id?: string;
  selected_downtime_type_id?: string;
  selected_additional_work_type_id?: string;
  selected_additional_work_id?: string;
  entered_comment?: string;
  entered_quantity?: string;
};
