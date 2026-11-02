import { getHeaders } from './api';

export interface ProviderPlacement {
    _id: string;
    providerKey: string;
    placementEnabled: boolean;
    parentTabId: string;
    subTabId: string;
    subTabName?: string;
    displayName: string;
    descriptionOverride?: string;
    badgeOverride?: string;
    displayOrder: number;
    targetingMode: 'all' | 'selected_users' | 'test_users';
    selectedUserIds?: any[];
    testUserIds?: any[];
    allowedCountries?: string[];
    excludedCountries?: string[];
    rolloutPercentage: number;
    rolloutSalt?: string;
    providerInfo?: {
        name: string;
        category: string;
        group: string;
        status: string;
        enabled: boolean;
        icon?: string;
        badge?: string;
        description?: string;
    };
    icon?: string;
    badge?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProviderCatalogItem {
    providerKey: string;
    name: string;
    category: string;
    group: string;
    enabled: boolean;
    status: string;
    approvalStatus?: string;
    integrationStatus?: string;
    icon?: string;
    badge?: string;
    description?: string;
    technicalReadinessScore?: number;
    approvalLikelihoodScore?: string;
    complianceNotes?: string;
}

export interface PlacementAuditLog {
    _id: string;
    placementId: string;
    adminId: string;
    adminUsername: string;
    action: 'CREATED' | 'UPDATED' | 'DELETED' | 'TOGGLED';
    changes: any;
    createdAt: string;
}

export interface LaunchPlacementResponse {
    success: boolean;
    launchUrl: string;
    displayName: string;
    providerKey: string;
    displayMode?: 'embed' | 'modal' | 'redirect' | 'card_list';
}

const API_BASE = '/api/v1/provider-placements';

export const fetchAvailablePlacements = async (parentTabId: string): Promise<ProviderPlacement[]> => {
    const res = await fetch(`${API_BASE}/available/${parentTabId}`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch available provider placements');
    }
    return Array.isArray(data.data) ? data.data : [];
};

export const launchPlacement = async (placementId: string): Promise<LaunchPlacementResponse> => {
    const res = await fetch(`${API_BASE}/${placementId}/launch`, {
        method: 'POST',
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to launch provider placement session');
    }
    return data;
};

export const fetchAdminPlacements = async (): Promise<ProviderPlacement[]> => {
    const res = await fetch(`${API_BASE}/admin`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};

export const fetchAdminCatalog = async (): Promise<ProviderCatalogItem[]> => {
    const res = await fetch(`${API_BASE}/admin/catalog`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};

export const createAdminPlacement = async (payload: Partial<ProviderPlacement>): Promise<ProviderPlacement> => {
    const res = await fetch(`${API_BASE}/admin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create provider placement');
    }
    return data.data;
};

export const updateAdminPlacement = async (placementId: string, payload: Partial<ProviderPlacement>): Promise<ProviderPlacement> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update provider placement');
    }
    return data.data;
};

export const deleteAdminPlacement = async (placementId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete provider placement');
    }
};

export const previewPlacementEligibility = async (placementId: string, testUserId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/admin/${placementId}/preview`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ testUserId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to preview placement eligibility');
    }
    return data.preview;
};

export const fetchAdminAuditLogs = async (): Promise<PlacementAuditLog[]> => {
    const res = await fetch(`${API_BASE}/admin/audit`, {
        headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.data)) {
        return data.data;
    }
    return [];
};
