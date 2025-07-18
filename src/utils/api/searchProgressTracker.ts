
export type SearchProgress = {
  total: number;
  completed: number;
  currentApi: string;
  errors: string[];
};

export class SearchProgressTracker {
  private progress: SearchProgress = {
    total: 0,
    completed: 0,
    currentApi: '',
    errors: []
  };
  
  private callbacks: ((progress: SearchProgress) => void)[] = [];

  setTotal(total: number) {
    this.progress.total = total;
    this.notifyCallbacks();
  }

  updateProgress(apiName: string, isComplete: boolean = false, error?: string) {
    this.progress.currentApi = apiName;
    if (isComplete) {
      this.progress.completed++;
    }
    if (error) {
      this.progress.errors.push(`${apiName}: ${error}`);
    }
    this.notifyCallbacks();
  }

  onProgress(callback: (progress: SearchProgress) => void) {
    this.callbacks.push(callback);
  }

  getProgress(): SearchProgress {
    return { ...this.progress };
  }

  reset() {
    this.progress = {
      total: 0,
      completed: 0,
      currentApi: '',
      errors: []
    };
    this.notifyCallbacks();
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.getProgress()));
  }
}

export const searchProgressTracker = new SearchProgressTracker();
