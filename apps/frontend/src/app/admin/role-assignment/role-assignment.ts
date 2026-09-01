import { Component, inject, OnInit, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { ApiClientService, GraphUser, RoleAssignment } from '../../api-client.service';
import { AvatarService } from '../../recipient-search/avatar.service';

@Component({
  imports: [FormsModule],
  selector: 'app-role-assignment',
  templateUrl: './role-assignment.html',
  styleUrl: './role-assignment.css',
})
export class RoleAssignmentPage implements OnInit {
  private readonly apiClient = inject(ApiClientService);
  private readonly avatarService = inject(AvatarService);

  protected readonly assignments = signal<RoleAssignment[]>([]);
  protected readonly avatarUrls = signal<Record<string, string | null>>({});
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly query = signal('');
  protected readonly selected = signal<GraphUser | null>(null);
  protected newRole = 'admin';

  protected readonly suggestions = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((query) =>
        this.selected()?.displayName === query
          ? of<GraphUser[]>([])
          : from(this.apiClient.searchUsers(query)).pipe(catchError(() => of<GraphUser[]>([])))
      )
    ),
    { initialValue: [] as GraphUser[] }
  );

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    this.apiClient
      .getRoleAssignments()
      .then((assignments) => {
        this.assignments.set(assignments);
        this.loadAvatars(assignments.map((a) => a.objectId));
      })
      .catch(() => this.error.set('Could not load role assignments.'))
      .finally(() => this.loading.set(false));
  }

  private loadAvatars(objectIds: string[]): void {
    for (const objectId of objectIds) {
      if (objectId in this.avatarUrls()) continue;

      this.avatarService.get(`/roles/avatar/${objectId}`).then((url) => {
        this.avatarUrls.update((urls) => ({ ...urls, [objectId]: url }));
      });
    }
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (this.selected()) this.selected.set(null);
  }

  protected selectUser(user: GraphUser): void {
    this.selected.set(user);
    this.query.set(user.displayName);
    this.loadAvatars([user.id]);
  }

  protected async assign(): Promise<void> {
    const user = this.selected();
    if (!user) return;

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.apiClient.assignRole(user.id, this.newRole, user.displayName);
      this.query.set('');
      this.selected.set(null);
      this.reload();
    } catch {
      this.error.set('Could not assign the role.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(objectId: string): Promise<void> {
    this.error.set(null);
    try {
      await this.apiClient.removeRole(objectId);
      this.reload();
    } catch {
      this.error.set('Could not remove that role assignment.');
    }
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
