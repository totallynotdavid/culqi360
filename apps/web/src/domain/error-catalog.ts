import type { DomainErrorKind } from "~/domain/errors";

export const ERROR_CATALOG = {
  lead_not_found: { kind: "not_found", message: "No se encontró el cliente." },
  executive_not_found: {
    kind: "not_found",
    message: "No se encontró el ejecutivo.",
  },
  reservation_not_found: {
    kind: "not_found",
    message: "No se encontró la reserva.",
  },
  user_not_found: { kind: "not_found", message: "No se encontró el usuario." },
  request_not_found: {
    kind: "not_found",
    message: "No se encontró la solicitud.",
  },
  request_target_not_found: {
    kind: "not_found",
    message: "No se encontró el destinatario de la solicitud.",
  },
  team_not_found: { kind: "not_found", message: "No se encontró el equipo." },
  token_not_found: {
    kind: "not_found",
    message: "No se encontró el enlace de descarga.",
  },
  file_asset_not_found: {
    kind: "not_found",
    message: "No se encontró el archivo.",
  },
  venue_not_found: {
    kind: "not_found",
    message: "No se encontró la sede para este cliente.",
  },
  fulfillment_not_started: {
    kind: "not_found",
    message: "La entrega de este cliente aún no ha iniciado.",
  },
  fulfillment_unit_not_found: {
    kind: "not_found",
    message: "No se encontró el equipo de entrega.",
  },
  fulfillment_document_not_found: {
    kind: "not_found",
    message: "No se encontró el documento de entrega.",
  },
  invalid_fulfillment_step: {
    kind: "validation",
    message: "Esta acción no corresponde al paso actual de la entrega.",
  },
  invalid_fulfillment_action: {
    kind: "validation",
    message: "Acción de entrega inválida.",
  },
  fulfillment_product_required: {
    kind: "validation",
    message: "Primero define el producto del cliente.",
  },
  reject_reason_required: {
    kind: "validation",
    message: "Indica el motivo de la devolución.",
  },
  lead_not_in_fulfillment: {
    kind: "validation",
    message: "El cliente no está en etapa de entrega.",
  },
  pending_quotation_limit: {
    kind: "validation",
    message:
      "Tienes el máximo de cotizaciones pendientes de decisión. Acéptalas, solicita revisión o ciérralas antes de registrar nuevos clientes.",
  },
  invalid_pending_quotation_limit: {
    kind: "validation",
    message: "El límite de cotizaciones pendientes no es válido.",
  },
  pending_quotation_limit_out_of_range: {
    kind: "validation",
    message: "El límite de cotizaciones pendientes está fuera de rango.",
  },
  sale_proof_not_found: {
    kind: "not_found",
    message: "No se encontró el comprobante de venta.",
  },
  lead_organization_not_found: {
    kind: "not_found",
    message: "No se encontró la organización del cliente.",
  },
  lead_commercial_scope_missing: {
    kind: "not_found",
    message: "No se encontró el alcance comercial del cliente.",
  },
  file_storage_missing: {
    kind: "not_found",
    message: "No se encontró el archivo en el almacenamiento.",
  },
  file_not_found: {
    kind: "not_found",
    message: "No se encontró el archivo de negociación.",
  },
  assignment_not_found: {
    kind: "not_found",
    message: "No se encontró el cliente asignado.",
  },
  import_job_not_found: {
    kind: "not_found",
    message: "No se encontró el proceso de importación.",
  },
  merchant_attribution_not_found: {
    kind: "not_found",
    message: "No se encontró la atribución de ese comercio para ese mes.",
  },
  merchant_credit_source_not_found: {
    kind: "not_found",
    message:
      "No se encontró una organización y actualización publicada para acreditar este GPV.",
  },
  gpv_snapshot_not_found: {
    kind: "not_found",
    message: "No se encontró la actualización de GPV.",
  },
  gpv_snapshot_issue_not_found: {
    kind: "not_found",
    message: "No se encontró la incidencia de la actualización.",
  },
  gpv_snapshot_previous_placement_not_found: {
    kind: "not_found",
    message: "No se encontró la colocación del corte anterior.",
  },
  // Also returned when the RUC exists but is not the caller's client: an
  // executive must not be able to probe which RUCs the book contains.
  merchant_stats_not_found: {
    kind: "not_found",
    message: "No se encontró información de GPV para este comercio.",
  },
  resource_not_found: {
    kind: "not_found",
    message: "No se encontró el recurso solicitado.",
  },
  commission_scheme_not_found: {
    kind: "not_found",
    message: "No se encontró un esquema de comisiones vigente.",
  },

  commission_target_negative: {
    kind: "validation",
    message: "La meta de la caja 3 no puede ser negativa.",
  },
  commission_activation_threshold_negative: {
    kind: "validation",
    message: "Los criterios de activación no pueden ser negativos.",
  },
  commission_m0_target_negative: {
    kind: "validation",
    message: "La meta de activas en M0 no puede ser negativa.",
  },
  commission_active_pos_threshold_negative: {
    kind: "validation",
    message: "El mínimo de POS activo no puede ser negativo.",
  },
  commission_corporate_caja2_threshold_negative: {
    kind: "validation",
    message: "Los criterios de la caja 2 de mesa 1 no pueden ser negativos.",
  },
  commission_reversion_threshold_negative: {
    kind: "validation",
    message: "El mínimo de M2 para evitar la reversión no puede ser negativo.",
  },
  commission_reversion_pct_out_of_range: {
    kind: "validation",
    message: "El porcentaje de reversión debe estar entre 0% y 100%.",
  },
  commission_activation_floor_negative: {
    kind: "validation",
    message: "El mínimo de activación por mesa no puede ser negativo.",
  },
  commission_inactive_rate_out_of_range: {
    kind: "validation",
    message: "El porcentaje máximo de inactivas debe estar entre 0% y 100%.",
  },
  commission_executive_bar_negative: {
    kind: "validation",
    message: "El mínimo de activación por ejecutivo no puede ser negativo.",
  },
  commission_bands_empty: {
    kind: "validation",
    message: "Debe haber al menos un rango configurado.",
  },
  commission_bands_not_ascending: {
    kind: "validation",
    message: "Los rangos deben estar en orden ascendente y no superponerse.",
  },
  commission_band_range_invalid: {
    kind: "validation",
    message: "El máximo de un rango debe ser mayor que su mínimo.",
  },
  commission_band_open_end_not_last: {
    kind: "validation",
    message: "Solo el último rango puede quedar sin máximo.",
  },
  commission_band_payout_negative: {
    kind: "validation",
    message: "El pago de un rango no puede ser negativo.",
  },

  request_not_pending: {
    kind: "conflict",
    message: "La solicitud ya no está pendiente.",
  },
  gpv_snapshot_not_activatable: {
    kind: "conflict",
    message: "Esta actualización de GPV no se puede activar.",
  },
  gpv_snapshot_superseded: {
    kind: "conflict",
    message: "Ya se publicó una actualización de GPV más reciente.",
  },
  gpv_snapshot_issue_not_resolvable: {
    kind: "conflict",
    message: "Esta incidencia ya no se puede resolver.",
  },
  gpv_snapshot_resolution_invalid: {
    kind: "conflict",
    message: "Esa decisión no corresponde a este tipo de incidencia.",
  },
  gpv_snapshot_issue_has_no_placement: {
    kind: "conflict",
    message: "La incidencia no identifica una colocación.",
  },
  organization_assignment_time_invalid: {
    kind: "conflict",
    message: "La reasignación debe ser posterior a la asignación vigente.",
  },
  token_already_used: {
    kind: "conflict",
    message: "El enlace de descarga ya fue utilizado.",
  },
  token_expired: {
    kind: "conflict",
    message: "El enlace de descarga expiró.",
  },
  totp_already_enabled: {
    kind: "conflict",
    message: "La verificación en dos pasos ya está activa.",
  },
  search_exhausted: {
    kind: "conflict",
    message: "Se agotó la capacidad de búsqueda.",
  },
  lead_exhausted: {
    kind: "conflict",
    message: "Se agotó la capacidad para asignar clientes.",
  },
  ruc_conflict: {
    kind: "conflict",
    message: "Ya existe un cliente con este RUC.",
  },
  inquiry_exists: {
    kind: "conflict",
    message: "Ya tienes una consulta activa para este RUC.",
  },
  inquiry_lead_registered: {
    kind: "conflict",
    message: "Ya registraste un cliente con este RUC.",
  },
  inquiry_not_found: {
    kind: "not_found",
    message: "No se encontró la consulta.",
  },
  inquiry_not_owned: {
    kind: "forbidden",
    message: "La consulta pertenece a otro ejecutivo.",
  },
  inquiry_converted: {
    kind: "conflict",
    message: "Esta consulta ya fue registrada como cliente.",
  },
  inquiry_ruc_mismatch: {
    kind: "conflict",
    message: "El RUC no coincide con el de la consulta.",
  },
  phone_in_use: {
    kind: "conflict",
    message: "Este número de WhatsApp ya está en uso.",
  },
  rate_revision_file_not_submit_ready: {
    kind: "conflict",
    message: "El documento no está listo para enviarse con la revisión.",
  },
  lead_not_in_pricing: {
    kind: "conflict",
    message:
      "Los archivos de revisión solo pueden subirse cuando el cliente está en etapa de tarifa.",
  },
  rate_proposal_not_found: {
    kind: "conflict",
    message: "No hay una propuesta de tarifa para este cliente.",
  },
  rate_proposal_not_pending: {
    kind: "conflict",
    message: "La propuesta de tarifa ya fue resuelta.",
  },
  rate_proposal_expired: {
    kind: "conflict",
    message: "La propuesta de tarifa ya venció.",
  },
  invalid_rate_proposal_validity_days: {
    kind: "validation",
    message: "La vigencia de la propuesta debe ser un número entero.",
  },
  rate_proposal_validity_days_out_of_range: {
    kind: "validation",
    message: "La vigencia de la propuesta debe estar entre 1 y 90 días.",
  },
  lead_not_live: {
    kind: "conflict",
    message:
      "Los comprobantes de venta solo se permiten cuando el cliente está activo.",
  },
  concurrency_conflict: {
    kind: "conflict",
    message: "Otra persona modificó el cliente. Vuelve a intentarlo.",
  },
  assignment_inactive: {
    kind: "conflict",
    message: "El contacto asignado no está disponible.",
  },
  accounts_already_added: {
    kind: "conflict",
    message: "Esta sede ya tiene cuentas registradas.",
  },
  same_executive: {
    kind: "conflict",
    message: "El cliente ya está asignado a ese ejecutivo.",
  },
  max_rate_revision_rounds_reached: {
    kind: "conflict",
    message: "Se alcanzó el máximo de rondas de revisión de tarifa.",
  },
  strong_method_required: {
    kind: "conflict",
    message:
      "Tu rol requiere mantener al menos un método de verificación fuerte.",
  },

  invite_not_found: {
    kind: "not_found",
    message: "No se encontró la invitación.",
  },
  invite_target_missing: {
    kind: "not_found",
    message: "No se pudo encontrar al usuario de la invitación.",
  },
  invite_target_active: {
    kind: "conflict",
    message: "El usuario invitado ya está activo.",
  },
  invite_token_malformed: {
    kind: "validation",
    message: "El enlace de invitación no es válido.",
  },
  invite_password_too_short: {
    kind: "validation",
    message: "La contraseña debe tener al menos 12 caracteres.",
  },
  invite_password_missing_uppercase: {
    kind: "validation",
    message: "La contraseña debe incluir una letra mayúscula.",
  },
  invite_password_missing_lowercase: {
    kind: "validation",
    message: "La contraseña debe incluir una letra minúscula.",
  },
  invite_password_missing_number: {
    kind: "validation",
    message: "La contraseña debe incluir un número.",
  },
  invite_not_pending: {
    kind: "conflict",
    message: "Solo se pueden gestionar invitaciones pendientes.",
  },
  active_user_exists: {
    kind: "conflict",
    message: "Ya existe un usuario activo con este correo.",
  },
  invalid_team: {
    kind: "validation",
    message: "El equipo seleccionado no es válido para la sede.",
  },
  invite_invalid_or_expired: {
    kind: "validation",
    message: "La invitación es inválida o expiró.",
  },
  role_not_assignable: {
    kind: "forbidden",
    message: "No puedes asignar el rol seleccionado.",
  },
  cross_branch_forbidden: {
    kind: "forbidden",
    message: "No puedes gestionar invitaciones de otra sede.",
  },
  pending_user_other_branch: {
    kind: "forbidden",
    message: "Ya existe un usuario pendiente con este correo en otra sede.",
  },

  cannot_manage_executive: {
    kind: "forbidden",
    message: "No puedes gestionar este ejecutivo.",
  },
  cannot_manage_member: {
    kind: "forbidden",
    message: "No puedes gestionar a este usuario.",
  },
  cannot_manage_self: {
    kind: "forbidden",
    message: "No puedes aplicar esta acción sobre tu propia cuenta.",
  },
  cannot_impersonate: {
    kind: "forbidden",
    message: "No puedes suplantar a este usuario.",
  },
  member_has_active_leads: {
    kind: "conflict",
    message:
      "El usuario tiene clientes activos asignados. Reasigna sus clientes antes de eliminarlo.",
  },
  not_impersonating: {
    kind: "conflict",
    message: "No hay una sesión de suplantación activa.",
  },
  extension_session_invalid: {
    kind: "forbidden",
    message: "La sesión de la extensión es inválida o expiró.",
  },
  onboarding_required: {
    kind: "forbidden",
    message: "Debes completar el registro para continuar.",
  },
  strong_auth_required: {
    kind: "forbidden",
    message: "Necesitas verificación adicional para continuar.",
  },
  strong_auth_expired: {
    kind: "forbidden",
    message:
      "Tu verificación adicional expiró. Vuelve a verificar tu identidad.",
  },
  call_not_found: {
    kind: "not_found",
    message: "No se encontró la llamada.",
  },
  recording_not_found: {
    kind: "not_found",
    message: "No se encontró la grabación.",
  },
  recording_closed: {
    kind: "conflict",
    message: "La grabación ya está completa y no acepta más segmentos.",
  },
  segment_conflict: {
    kind: "conflict",
    message: "El segmento ya existe con un contenido distinto.",
  },
  recording_manifest_mismatch: {
    kind: "conflict",
    message: "El tamaño total no coincide con los segmentos guardados.",
  },
  handoff_invalid: {
    kind: "forbidden",
    message: "El enlace de la extensión es inválido o expiró.",
  },
  handoff_claimed_by_other_installation: {
    kind: "forbidden",
    message: "El enlace de la extensión ya fue usado por otra instalación.",
  },
  handoff_origin_not_allowed: {
    kind: "forbidden",
    message: "El origen de la solicitud no está permitido para la extensión.",
  },
  assignment_mismatch: {
    kind: "forbidden",
    message: "La asignación del contacto no está activa o no coincide.",
  },
  invalid_credentials: {
    kind: "forbidden",
    message: "Credenciales inválidas.",
  },
  current_password_incorrect: {
    kind: "forbidden",
    message: "La contraseña actual es incorrecta.",
  },

  flow_expired: {
    kind: "validation",
    message: "La sesión de inicio expiró. Intenta de nuevo.",
  },
  invalid_passkey_request: {
    kind: "validation",
    message: "La solicitud de acceso no es válida.",
  },
  file_required: { kind: "validation", message: "Selecciona un archivo." },
  file_too_large: {
    kind: "validation",
    message: "El archivo es demasiado grande.",
  },
  profile_picture_required: {
    kind: "validation",
    message: "Selecciona una foto de perfil.",
  },
  totp_code_invalid: {
    kind: "validation",
    message: "El código de verificación no es válido.",
  },
  recovery_code_invalid: {
    kind: "validation",
    message: "El código de recuperación no es válido.",
  },
  totp_setup_invalid: {
    kind: "validation",
    message: "La configuración de verificación no es válida.",
  },
  download_payload_invalid: {
    kind: "validation",
    message: "La solicitud de descarga no es válida.",
  },
  unsupported_file_type: {
    kind: "validation",
    message: "Solo se permiten archivos .csv y .xlsx.",
  },
  gpv_cut_required: {
    kind: "validation",
    message:
      "No se pudo leer la fecha de corte del nombre del archivo. Indícala antes de subirlo.",
  },
  gpv_no_worksheet: {
    kind: "validation",
    message:
      "El archivo no tiene ninguna hoja con las columnas del reporte GPV.",
  },
  rate_revision_files_required: {
    kind: "validation",
    message: "Se requiere al menos un documento para la revisión.",
  },
  max_rate_revision_files_exceeded: {
    kind: "validation",
    message: "Se superó el máximo de archivos permitidos.",
  },
  duplicate_rate_revision_file: {
    kind: "validation",
    message: "Los archivos de revisión deben ser únicos.",
  },
  invalid_stage: {
    kind: "validation",
    message: "El cliente no está en la etapa requerida.",
  },
  invalid_settlement_account: {
    kind: "validation",
    message: "Debes marcar exactamente una cuenta de abono.",
  },
  invalid_phone: {
    kind: "validation",
    message: "El número debe tener 9 dígitos y empezar con 9.",
  },
  invalid_executive: {
    kind: "validation",
    message: "El ejecutivo seleccionado no existe o no está activo.",
  },
  invalid_digital_policy_stage: {
    kind: "validation",
    message: "La política digital solo puede actualizarse en la etapa de plan.",
  },
  invalid_existing_venue_digital_config: {
    kind: "validation",
    message:
      "Una sede es incompatible con la política de canal digital seleccionada.",
  },
  missing_online_venue_config: {
    kind: "validation",
    message:
      "La URL y la modalidad online de la sede son obligatorias para el alcance por sede.",
  },
  missing_online_shared_config: {
    kind: "validation",
    message:
      "La URL y la modalidad online compartidas son obligatorias para el alcance compartido.",
  },
  missing_link_venue_url: {
    kind: "validation",
    message:
      "La URL del enlace de la sede es obligatoria para el alcance por sede.",
  },
  missing_link_shared_url: {
    kind: "validation",
    message: "La URL del enlace es obligatoria para el alcance compartido.",
  },
  invalid_online_venue_config: {
    kind: "validation",
    message:
      "La configuración online de la sede no corresponde al alcance elegido.",
  },
  invalid_online_policy: {
    kind: "validation",
    message:
      "Los campos online compartidos no corresponden al alcance elegido.",
  },
  invalid_link_venue_config: {
    kind: "validation",
    message:
      "La configuración del enlace de la sede no corresponde al alcance elegido.",
  },
  invalid_link_policy: {
    kind: "validation",
    message: "Los campos del enlace no corresponden al alcance elegido.",
  },
  decision_note_required: {
    kind: "validation",
    message: "La nota de decisión es obligatoria para rechazar.",
  },
  invalid_ruc: {
    kind: "validation",
    message: "El RUC debe tener 11 dígitos. Intenta nuevamente.",
  },
  invalid_dni: {
    kind: "validation",
    message: "El DNI debe tener 8 dígitos. Intenta nuevamente.",
  },
  invalid_document_type: {
    kind: "validation",
    message: "El tipo de documento no es válido.",
  },
  ruc_required: { kind: "validation", message: "Ingresa el RUC del cliente." },
  missing_cci_soles: {
    kind: "validation",
    message:
      "El CCI es obligatorio para la cuenta en soles cuando el banco no es BCP.",
  },
  missing_cci_dolares: {
    kind: "validation",
    message:
      "El CCI es obligatorio para la cuenta en dólares cuando el banco no es BCP.",
  },
  invalid_email: { kind: "validation", message: "El correo no es válido." },
  invalid_team_id: {
    kind: "validation",
    message: "El equipo seleccionado no es válido.",
  },
  invalid_executive_category: {
    kind: "validation",
    message: "Selecciona una categoría válida para el ejecutivo.",
  },
  invalid_expires_at: {
    kind: "validation",
    message: "La fecha de expiración es inválida.",
  },
  expires_at_too_soon: {
    kind: "validation",
    message: "La expiración debe ser al menos 7 días en el futuro.",
  },
  expires_on_too_soon: {
    kind: "validation",
    message: "La expiración debe ser al menos 7 días en el futuro.",
  },
  invalid_amount: {
    kind: "validation",
    message: "El monto debe ser un entero positivo.",
  },
  amount_exceeds_max: {
    kind: "validation",
    message: "El monto supera el máximo permitido.",
  },
  invalid_search_limit: {
    kind: "validation",
    message: "El límite mensual debe ser mayor que cero.",
  },
  search_limit_exceeds_max: {
    kind: "validation",
    message: "El límite mensual supera el máximo permitido.",
  },
  invalid_buffer_target: {
    kind: "validation",
    message: "El límite de clientes activos debe ser mayor que cero.",
  },
  buffer_target_exceeds_max: {
    kind: "validation",
    message: "El límite de clientes activos supera el máximo permitido.",
  },
  invalid_daily_refill: {
    kind: "validation",
    message: "El límite diario debe ser mayor que cero.",
  },
  daily_refill_exceeds_max: {
    kind: "validation",
    message: "El límite diario supera el máximo permitido.",
  },
  invalid_consumed_amount: {
    kind: "validation",
    message: "La cantidad consumida no es válida para esta reserva.",
  },

  email_required: {
    kind: "validation",
    message: "Ingresa tu correo electrónico.",
  },
  rate_limited: {
    kind: "validation",
    message: "Demasiados intentos. Espera un momento e intenta de nuevo.",
  },
  invalid_token: {
    kind: "validation",
    message: "El enlace no es válido o ya venció. Solicita uno nuevo.",
  },
  password_too_short: {
    kind: "validation",
    message: "La contraseña debe tener al menos 8 caracteres.",
  },
  password_mismatch: {
    kind: "validation",
    message: "Las contraseñas no coinciden.",
  },
  installation_password_change_required: {
    kind: "forbidden",
    message: "Cambia la contraseña temporal antes de continuar.",
  },
  installation_password_must_change: {
    kind: "validation",
    message:
      "La nueva contraseña debe ser diferente de la contraseña temporal.",
  },
  invalid_input: {
    kind: "validation",
    message: "Los datos enviados no son válidos.",
  },
} as const satisfies Record<string, { kind: DomainErrorKind; message: string }>;

export type DomainCode = keyof typeof ERROR_CATALOG;
